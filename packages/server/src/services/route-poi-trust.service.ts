import type { RouteDetailPayload, RouteDayAttraction } from '@douxing/shared';
import { CheckInStatus } from '@douxing/shared';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { isAmapImageEnrichEnabled } from '../config/amap.js';
import { getDb } from '../db/client.js';
import { checkIns } from '../db/schema/check-ins.js';
import { rewritePublicAssetUrl } from '../utils/public-asset-url.util.js';
import {
  extractAttractionIdsFromRouteDetail,
  getAttractionsByIdsForRouteMedia,
} from './attraction.service.js';
import { enrichAttractionCoversForIds } from './attraction-image-enricher.service.js';
import {
  buildPoiMediaIndexKey,
  listApprovedRouteMediaBundle,
} from './route-media.service.js';

const POI_CHECKIN_PHOTO_LIMIT = 6;

/**
 * 聚合路线上各景点的他人打卡实拍缩略图（仅已通过审核的打卡）。
 *
 * @param routeId - 路线 ID
 * @param attractionIds - 景点库 ID 列表
 * @param limitPerPoi - 每个 POI 最多返回张数
 * @returns attractionId → 公网可访问图片 URL 列表
 */
export async function listRoutePoiCheckInPhotoUrls(
  routeId: number,
  attractionIds: number[],
  limitPerPoi = POI_CHECKIN_PHOTO_LIMIT,
): Promise<Map<number, string[]>> {
  const uniqueIds = [...new Set(attractionIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (uniqueIds.length === 0) return new Map();

  const db = getDb();
  const rows = await db
    .select({
      attractionId: checkIns.attractionId,
      photos: checkIns.photos,
    })
    .from(checkIns)
    .where(
      and(
        eq(checkIns.routeId, routeId),
        inArray(checkIns.attractionId, uniqueIds),
        eq(checkIns.status, CheckInStatus.APPROVED),
        isNotNull(checkIns.photos),
      ),
    )
    .orderBy(desc(checkIns.checkedAt));

  const result = new Map<number, string[]>();
  for (const row of rows) {
    const aid = row.attractionId;
    if (aid == null) continue;
    const bucket = result.get(aid) ?? [];
    if (bucket.length >= limitPerPoi) continue;
    const photos = Array.isArray(row.photos) ? row.photos : [];
    for (const raw of photos) {
      if (typeof raw !== 'string' || !raw.trim()) continue;
      if (bucket.length >= limitPerPoi) break;
      const rewritten = rewritePublicAssetUrl(raw);
      if (rewritten) bucket.push(rewritten);
    }
    if (bucket.length > 0) {
      result.set(aid, bucket);
    }
  }
  return result;
}

/**
 * 为路线详情 POI 注入景点库说明、他人打卡图与已审核 UGC 短视频（只读展示，不写回 DB）。
 *
 * @param routeDetail - 路线 `route_detail` JSON
 * @param routeId - 路线 ID；用于聚合社交素材，缺省时跳过
 * @returns 富化后的详情；入参无效时原样返回
 */
export async function enrichRouteDetailWithPoiTrust(
  routeDetail: Record<string, unknown> | null,
  routeId?: number,
): Promise<Record<string, unknown> | null> {
  if (!routeDetail || typeof routeDetail !== 'object') return routeDetail;

  const detail = routeDetail as unknown as RouteDetailPayload;
  if (!Array.isArray(detail.days)) return routeDetail;

  const ids = extractAttractionIdsFromRouteDetail(detail);

  let catalog = ids.length > 0 ? await getAttractionsByIdsForRouteMedia(ids) : [];
  const missingCoverIds = catalog.filter((item) => !item.coverImageUrl).map((item) => item.id);
  if (missingCoverIds.length > 0 && isAmapImageEnrichEnabled()) {
    await enrichAttractionCoversForIds(missingCoverIds, { delayMs: 100, maxCount: 16 });
    catalog = await getAttractionsByIdsForRouteMedia(ids);
  }

  const coverById = new Map<number, string>();
  const descriptionById = new Map<number, string>();
  for (const item of catalog) {
    if (item.coverImageUrl) coverById.set(item.id, item.coverImageUrl);
    if (item.description?.trim()) descriptionById.set(item.id, item.description.trim());
  }

  const checkInPhotosById =
    routeId != null && Number.isFinite(routeId) && ids.length > 0
      ? await listRoutePoiCheckInPhotoUrls(routeId, ids)
      : new Map<number, string[]>();

  const mediaBundle =
    routeId != null && Number.isFinite(routeId)
      ? await listApprovedRouteMediaBundle(routeId)
      : { routeVideo: null, poiByAttractionId: new Map(), poiByDayAndName: new Map() };

  const days = detail.days.map((day, dayIndex) => {
    if (!day?.attractions?.length) return day;
    const attractions = day.attractions.map((spot): RouteDayAttraction => {
      const patch: RouteDayAttraction = { ...spot };
      let touched = false;

      if (spot.attractionId != null) {
        const coverImageUrl = coverById.get(spot.attractionId);
        const catalogDescription = descriptionById.get(spot.attractionId);
        const checkInPhotoUrls = checkInPhotosById.get(spot.attractionId);
        const poiVideo = mediaBundle.poiByAttractionId.get(spot.attractionId);

        if (coverImageUrl) {
          patch.coverImageUrl = coverImageUrl;
          touched = true;
        }
        if (catalogDescription) {
          patch.catalogDescription = catalogDescription;
          touched = true;
        }
        if (checkInPhotoUrls?.length) {
          patch.checkInPhotoUrls = checkInPhotoUrls;
          touched = true;
        }
        if (poiVideo) {
          patch.videoUrl = poiVideo.videoUrl;
          patch.videoCoverUrl = poiVideo.coverUrl ?? null;
          patch.videoDurationSec = poiVideo.durationSec;
          touched = true;
        }
      } else if (spot.name?.trim()) {
        const poiVideo = mediaBundle.poiByDayAndName.get(
          buildPoiMediaIndexKey(dayIndex, spot.name),
        );
        if (poiVideo) {
          patch.videoUrl = poiVideo.videoUrl;
          patch.videoCoverUrl = poiVideo.coverUrl ?? null;
          patch.videoDurationSec = poiVideo.durationSec;
          touched = true;
        }
      }

      return touched ? patch : spot;
    });
    return { ...day, attractions };
  });

  const nextDetail: RouteDetailPayload = { ...detail, days };
  if (mediaBundle.routeVideo) {
    nextDetail.routeVideo = mediaBundle.routeVideo;
  }

  return nextDetail as unknown as Record<string, unknown>;
}
