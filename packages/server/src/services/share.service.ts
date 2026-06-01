import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { RouteStatus, ApiError, ApiMessageKey } from '@douxing/shared';
import type { TravelRouteInfo } from '@douxing/shared';
import { toRouteInfo } from '../utils/route-info.util.js';
import { enrichRoutesWithCreatorInfo } from './route-interaction.service.js';
import { enrichRouteDetailWithAttractionCovers } from './route-attraction-media.service.js';

function stripSensitiveRouteDetail(detail: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!detail) return null;
  const next: Record<string, unknown> = { ...detail, isUnlocked: true };
  delete next.sourcePrompt;
  delete next.llmProviderChoice;
  return next;
}

/** 广场公开路线只读摘要（D5-a） */
export async function getPublicSharedRoute(routeId: number): Promise<TravelRouteInfo | null> {
  const db = getDb();
  const rows = await db.select().from(travelRoutes).where(eq(travelRoutes.id, routeId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.status !== RouteStatus.PUBLISHED || row.isPublic !== 1) {
    return null;
  }

  let route = toRouteInfo(row);
  route = {
    ...route,
    routeDetail: stripSensitiveRouteDetail(route.routeDetail as Record<string, unknown> | null),
    isUnlocked: true,
    sourcePrompt: null,
  };

  [route] = await enrichRoutesWithCreatorInfo([route]);
  if (route.routeDetail) {
    route.routeDetail =
      (await enrichRouteDetailWithAttractionCovers(route.routeDetail)) ?? route.routeDetail;
  }
  return route;
}

export async function assertPublicSharedRoute(routeId: number): Promise<TravelRouteInfo> {
  const route = await getPublicSharedRoute(routeId);
  if (!route) {
    throw new ApiError(ApiMessageKey.SHARE_ROUTE_NOT_AVAILABLE);
  }
  return route;
}

/** 海报分享码：已发布路线即可（不要求广场公开，便于生成分享图） */
export async function assertPublishedRouteForPoster(routeId: number): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(travelRoutes).where(eq(travelRoutes.id, routeId)).limit(1);
  const row = rows[0];
  if (!row || row.status !== RouteStatus.PUBLISHED) {
    throw new ApiError(ApiMessageKey.SHARE_ROUTE_NOT_AVAILABLE);
  }
}
