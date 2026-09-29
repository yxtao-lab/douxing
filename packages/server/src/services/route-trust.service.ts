import { and, count, desc, eq, gt, lt, or, sql } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  CheckInStatus,
  RouteContentTier,
  RouteModerationAction,
  RouteModerationStatus,
  ROUTE_STALE_DAYS,
  computeRouteHeatScore,
  computeRouteTrust,
  extractRouteQualitySignals,
  isRouteModerationAction,
  type RouteSpotCheckItem,
  type RouteTrustBreakdown,
  RouteReportStatus,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { checkIns } from '../db/schema/check-ins.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { routeReports } from '../db/schema/route-reports.js';
import { awardTravelReadyUpgrade } from './verification-points.service.js';
import { countOpenRouteReports } from './route-report.service.js';

/**
 * 重算单条路线可信度并回写层级（inspiration / travel_ready）。
 * 首次升级为可出行时给作者发放验证积分（U4）。
 * U5：计入未结案报错与过期扣分；尊重运营强制降级。
 *
 * @param routeId - 路线 ID
 * @returns 最新拆解；路线不存在时为 `null`
 */
export async function recomputeRouteTrust(routeId: number): Promise<RouteTrustBreakdown | null> {
  const db = getDb();
  const rows = await db.select().from(travelRoutes).where(eq(travelRoutes.id, routeId)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const previousTier = row.contentTier;
  const checkInRows = await db
    .select({ userId: checkIns.userId })
    .from(checkIns)
    .where(and(eq(checkIns.routeId, routeId), eq(checkIns.status, CheckInStatus.APPROVED)));
  const uniqueCheckInUsers = new Set(checkInRows.map((item) => item.userId)).size;

  const [{ value: forkCount }] = await db
    .select({ value: count() })
    .from(travelRoutes)
    .where(eq(travelRoutes.parentRouteId, routeId));

  const openReportCount = await countOpenRouteReports(routeId);
  const quality = extractRouteQualitySignals(row.routeDetail, row.description);
  const result = computeRouteTrust({
    uniqueCheckInUsers,
    updatedAtMs: row.updatedAt instanceof Date ? row.updatedAt.getTime() : Date.now(),
    nowMs: Date.now(),
    verificationStatus: row.verificationStatus,
    sourceKind: row.sourceKind,
    forkCount: Number(forkCount ?? 0),
    ...quality,
    trustCrowned: row.trustCrowned === 1,
    openReportCount,
    forceInspiration: row.trustDemoted === 1,
  });

  await db
    .update(travelRoutes)
    .set({
      trustScore: result.score,
      trustBreakdown: result.breakdown as unknown as Record<string, unknown>,
      contentTier: result.contentTier,
    })
    .where(eq(travelRoutes.id, routeId));

  if (
    previousTier !== RouteContentTier.TRAVEL_READY &&
    result.contentTier === RouteContentTier.TRAVEL_READY
  ) {
    try {
      await awardTravelReadyUpgrade(row.creatorId, routeId);
    } catch (err) {
      console.warn(
        '[route-trust] travel_ready 验证积分入账失败',
        routeId,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return result.breakdown;
}

/**
 * 重算路线可信度；失败只记日志，不阻断主流程。
 *
 * @param routeId - 路线 ID
 */
export async function recomputeRouteTrustSafe(routeId: number): Promise<void> {
  try {
    await recomputeRouteTrust(routeId);
  } catch (err) {
    console.warn(
      '[route-trust] 重算失败',
      routeId,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * 顺带刷新 fork 父路线的共识分。
 *
 * @param routeId - 子路线
 * @param parentRouteId - 父路线
 */
export async function recomputeRouteTrustWithParent(
  routeId: number,
  parentRouteId?: number | null,
): Promise<void> {
  await recomputeRouteTrustSafe(routeId);
  if (parentRouteId && parentRouteId !== routeId) {
    await recomputeRouteTrustSafe(parentRouteId);
  }
}

/**
 * U5：列出抽检队列（未结案报错 / 过期可出行 / 高热低可信）。
 *
 * @param limit - 返回条数
 * @returns 抽检条目
 */
export async function listRouteSpotCheck(limit = 50): Promise<RouteSpotCheckItem[]> {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit) || 50));
  const db = getDb();
  const staleBefore = new Date(Date.now() - ROUTE_STALE_DAYS * 24 * 60 * 60 * 1000);

  const openAgg = await db
    .select({
      routeId: routeReports.routeId,
      openReportCount: sql<number>`count(*)`,
    })
    .from(routeReports)
    .where(eq(routeReports.status, RouteReportStatus.OPEN))
    .groupBy(routeReports.routeId);

  const openMap = new Map<number, number>();
  for (const row of openAgg) {
    openMap.set(row.routeId, Number(row.openReportCount));
  }

  const candidates = await db
    .select()
    .from(travelRoutes)
    .where(
      and(
        eq(travelRoutes.isPublic, 1),
        or(
          inArrayIds([...openMap.keys()]),
          and(
            eq(travelRoutes.contentTier, RouteContentTier.TRAVEL_READY),
            lt(travelRoutes.updatedAt, staleBefore),
          ),
          and(
            gt(travelRoutes.likeCount, 20),
            lt(travelRoutes.trustScore, 40),
          ),
        ),
      ),
    )
    .orderBy(desc(travelRoutes.likeCount), desc(travelRoutes.updatedAt))
    .limit(safeLimit * 2);

  const items: RouteSpotCheckItem[] = [];
  for (const row of candidates) {
    const openReportCount = openMap.get(row.id) ?? 0;
    const heatScore = computeRouteHeatScore({
      likeCount: row.likeCount,
      commentCount: row.commentCount,
      collectCount: row.collectCount,
      viewCount: row.viewCount,
    });
    const spotReasons: string[] = [];
    if (openReportCount > 0) spotReasons.push('open_reports');
    if (
      row.contentTier === RouteContentTier.TRAVEL_READY &&
      row.updatedAt instanceof Date &&
      row.updatedAt < staleBefore
    ) {
      spotReasons.push('stale_travel_ready');
    }
    if (row.likeCount > 20 && (row.trustScore ?? 0) < 40) {
      spotReasons.push('hot_low_trust');
    }
    if (spotReasons.length === 0) continue;
    items.push({
      id: row.id,
      name: row.name,
      creatorId: row.creatorId,
      contentTier: row.contentTier,
      verificationStatus: row.verificationStatus,
      moderationStatus: row.moderationStatus,
      trustScore: row.trustScore ?? 0,
      heatScore,
      openReportCount,
      trustCrowned: row.trustCrowned === 1,
      updatedAt:
        row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
      spotReasons,
    });
    if (items.length >= safeLimit) break;
  }
  return items;
}

/**
 * 构造 inArray 条件；空列表时返回永假条件。
 *
 * @param ids - 路线 ID
 * @returns SQL 条件
 */
function inArrayIds(ids: number[]) {
  if (ids.length === 0) return sql`1 = 0`;
  return sql`${travelRoutes.id} in (${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )})`;
}

/**
 * U5：运营对单条路线执行处置。
 *
 * @param routeId - 路线
 * @param action - demote | hide | restore | crown | uncrown
 * @throws {ApiError} 动作非法或路线不存在
 */
export async function applyRouteModerationAction(
  routeId: number,
  action: string,
): Promise<void> {
  if (!isRouteModerationAction(action)) {
    throw new ApiError(ApiMessageKey.ROUTE_MODERATION_ACTION_INVALID);
  }
  const db = getDb();
  const rows = await db
    .select({ id: travelRoutes.id })
    .from(travelRoutes)
    .where(eq(travelRoutes.id, routeId))
    .limit(1);
  if (!rows[0]) throw new ApiError(ApiMessageKey.ROUTE_NOT_FOUND);

  switch (action) {
    case RouteModerationAction.DEMOTE:
      await db
        .update(travelRoutes)
        .set({
          trustDemoted: 1,
          trustCrowned: 0,
          contentTier: RouteContentTier.INSPIRATION,
        })
        .where(eq(travelRoutes.id, routeId));
      await recomputeRouteTrustSafe(routeId);
      break;
    case RouteModerationAction.HIDE:
      await db
        .update(travelRoutes)
        .set({
          moderationStatus: RouteModerationStatus.REJECTED,
          isPublic: 0,
        })
        .where(eq(travelRoutes.id, routeId));
      break;
    case RouteModerationAction.RESTORE:
      await db
        .update(travelRoutes)
        .set({
          trustDemoted: 0,
          moderationStatus: RouteModerationStatus.APPROVED,
          isPublic: 1,
        })
        .where(eq(travelRoutes.id, routeId));
      await recomputeRouteTrustSafe(routeId);
      break;
    case RouteModerationAction.CROWN:
      await db
        .update(travelRoutes)
        .set({ trustDemoted: 0, trustCrowned: 1 })
        .where(eq(travelRoutes.id, routeId));
      await recomputeRouteTrustSafe(routeId);
      break;
    case RouteModerationAction.UNCROWN:
      await db
        .update(travelRoutes)
        .set({ trustCrowned: 0 })
        .where(eq(travelRoutes.id, routeId));
      await recomputeRouteTrustSafe(routeId);
      break;
    default:
      throw new ApiError(ApiMessageKey.ROUTE_MODERATION_ACTION_INVALID);
  }
}
