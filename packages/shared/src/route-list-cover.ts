import type { RouteDetailPayload, TravelRouteInfo } from './types.js';

/** 从路线详情 JSON 中取第一张景点封面（生成时可能已内联） */
export function pickRouteCoverFromDetail(
  routeDetail: Record<string, unknown> | RouteDetailPayload | null | undefined,
): string | null {
  if (!routeDetail || typeof routeDetail !== 'object') return null;
  const days = (routeDetail as RouteDetailPayload).days;
  if (!Array.isArray(days)) return null;

  for (const day of days) {
    if (!day?.attractions?.length) continue;
    for (const spot of day.attractions) {
      const url = spot.coverImageUrl?.trim();
      if (url) return url;
    }
  }
  return null;
}

/** 列表卡片封面：优先 API 字段，其次详情内联图 */
export function resolveRouteListCoverImage(route: TravelRouteInfo): string | null {
  const fromApi = route.listCoverImageUrl?.trim();
  if (fromApi) return fromApi;
  return pickRouteCoverFromDetail(route.routeDetail);
}
