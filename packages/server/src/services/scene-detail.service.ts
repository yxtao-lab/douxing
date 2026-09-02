import { and, desc, eq, sql } from 'drizzle-orm';
import { RouteStatus, type AttractionInfo, type RouteDetailPayload } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { getAttractionsByIds, listAttractions } from './attraction.service.js';

/**
 * 从公开路线的 route_detail 中按出现频次（加权热度）汇总 attractionId。
 *
 * @param sceneSlug - 场景标签 slug
 * @param maxIds - 最多返回的景点 ID 数
 * @returns 按热度降序的景点 ID 列表
 */
async function listAttractionIdsFromSceneRoutes(
  sceneSlug: string,
  maxIds: number,
): Promise<number[]> {
  const db = getDb();
  const rows = await db
    .select({
      routeDetail: travelRoutes.routeDetail,
      viewCount: travelRoutes.viewCount,
      likeCount: travelRoutes.likeCount,
      commentCount: travelRoutes.commentCount,
    })
    .from(travelRoutes)
    .where(
      and(
        eq(travelRoutes.status, RouteStatus.PUBLISHED),
        eq(travelRoutes.isPublic, 1),
        sql`JSON_CONTAINS(IFNULL(${travelRoutes.sceneTags}, '[]'), JSON_QUOTE(${sceneSlug}))`,
      ),
    )
    .orderBy(
      desc(
        sql`${travelRoutes.likeCount} * 2 + ${travelRoutes.viewCount} + ${travelRoutes.commentCount}`,
      ),
    )
    .limit(40);

  const freq = new Map<number, number>();
  for (const row of rows) {
    const weight = 1 + (row.likeCount ?? 0) * 2 + Math.floor((row.viewCount ?? 0) / 10);
    const detail = row.routeDetail as RouteDetailPayload | null | undefined;
    for (const day of detail?.days ?? []) {
      for (const poi of day.attractions ?? []) {
        const id = poi.attractionId;
        if (!id || id <= 0) continue;
        const poiType = poi.poiType ?? 'attraction';
        if (
          poiType === 'restaurant' ||
          poiType === 'hotel' ||
          poiType === 'meal' ||
          poiType === 'transport'
        ) {
          continue;
        }
        freq.set(id, (freq.get(id) ?? 0) + weight);
      }
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, Math.max(0, maxIds));
}

/**
 * 专题页热门景点：优先已打 `sceneTags` 的库内景点；不足时从该场景公开路线 POI 按热度补齐。
 *
 * 解决景点库尚未批量打场景标签时，专题「热门景点」长期空白、而「精选路线」已有内容的体验断层。
 *
 * @param sceneSlug - 场景标签 slug（如 date / kids）
 * @param limit - 返回条数上限，默认 10（专题 TOP10）
 * @returns 景点信息列表；均无数据时为空数组
 */
export async function listHotAttractionsForScene(
  sceneSlug: string,
  limit = 10,
): Promise<AttractionInfo[]> {
  const capped = Math.min(Math.max(limit, 1), 50);
  const tagged = await listAttractions({
    sceneTags: [sceneSlug],
    limit: capped,
    offset: 0,
  });
  if (tagged.length >= capped) {
    return tagged;
  }

  const rankedIds = await listAttractionIdsFromSceneRoutes(sceneSlug, capped * 3);
  const have = new Set(tagged.map((a) => a.id));
  const needIds = rankedIds.filter((id) => !have.has(id)).slice(0, capped - tagged.length);
  if (needIds.length === 0) {
    return tagged;
  }

  const extras = await getAttractionsByIds(needIds);
  const byId = new Map(extras.map((a) => [a.id, a]));
  const orderedExtras = needIds
    .map((id) => byId.get(id))
    .filter((a): a is AttractionInfo => Boolean(a));

  return [...tagged, ...orderedExtras].slice(0, capped);
}
