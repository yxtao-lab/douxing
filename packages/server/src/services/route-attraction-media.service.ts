import type { RouteDetailPayload } from '@douxing/shared';
import { isAmapImageEnrichEnabled } from '../config/amap.js';
import {
  getAttractionsByIdsForRouteMedia,
  extractAttractionIdsFromRouteDetail,
} from './attraction.service.js';
import { enrichAttractionCoversForIds } from './attraction-image-enricher.service.js';

/** 为路线详情 POI 注入景点封面（只读展示，不写回 DB） */
export async function enrichRouteDetailWithAttractionCovers(
  routeDetail: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (!routeDetail || typeof routeDetail !== 'object') return routeDetail;

  const ids = extractAttractionIdsFromRouteDetail(routeDetail as unknown as RouteDetailPayload);
  if (ids.length === 0) return routeDetail;

  let catalog = await getAttractionsByIdsForRouteMedia(ids);

  const missingCoverIds = catalog.filter((item) => !item.coverImageUrl).map((item) => item.id);
  if (missingCoverIds.length > 0 && isAmapImageEnrichEnabled()) {
    await enrichAttractionCoversForIds(missingCoverIds, { delayMs: 100, maxCount: 16 });
    catalog = await getAttractionsByIdsForRouteMedia(ids);
  }

  const coverById = new Map<number, string>();
  for (const item of catalog) {
    if (item.coverImageUrl) {
      coverById.set(item.id, item.coverImageUrl);
    }
  }
  if (coverById.size === 0) return routeDetail;

  const detail = routeDetail as unknown as RouteDetailPayload;
  if (!Array.isArray(detail.days)) return routeDetail;

  const days = detail.days.map((day) => {
    if (!day?.attractions?.length) return day;
    const attractions = day.attractions.map((spot) => {
      const coverImageUrl =
        spot.attractionId != null ? coverById.get(spot.attractionId) : undefined;
      if (!coverImageUrl) return spot;
      return { ...spot, coverImageUrl };
    });
    return { ...day, attractions };
  });

  return { ...detail, days };
}
