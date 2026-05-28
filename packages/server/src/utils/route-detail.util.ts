import type { RouteDayAttraction } from '@douxing/shared';
import type { RouteDayPlan } from '../data/route-templates.js';

/** 从生成结果或历史 routeDetail 中提取可同步的 days */
export function normalizeRouteDetailDays(
  routeDetail: { days: RouteDayPlan[] } | Record<string, unknown> | null | undefined,
): { days: RouteDayPlan[] } {
  if (!routeDetail || typeof routeDetail !== 'object') {
    return { days: [] };
  }
  const rd = routeDetail as Record<string, unknown>;
  if (Array.isArray(rd.days)) {
    return { days: rd.days as RouteDayPlan[] };
  }
  const nested = rd.routeDetail;
  if (nested && typeof nested === 'object') {
    const nestedDays = (nested as Record<string, unknown>).days;
    if (Array.isArray(nestedDays)) {
      return { days: nestedDays as RouteDayPlan[] };
    }
  }
  return { days: [] };
}

/** 深拷贝行程节点，保留 Enricher 产出的 lodging / transit / warnings */
export function cloneRouteDaysForSync(
  days: RouteDayPlan[],
  stripAttractionIds = false,
): RouteDayPlan[] {
  return days.map((day) => ({
    date: day.date,
    title: day.title,
    lodging: day.lodging ? { ...day.lodging } : undefined,
    transit: day.transit?.map((seg) => ({ ...seg })),
    warnings: day.warnings ? [...day.warnings] : undefined,
    attractions: day.attractions.map((spot) => {
      const cloned: RouteDayAttraction = {
        name: spot.name,
        time: spot.time,
        cost: spot.cost,
        description: spot.description,
        poiType: spot.poiType,
        latitude: spot.latitude,
        longitude: spot.longitude,
      };
      if (!stripAttractionIds && spot.attractionId != null) {
        cloned.attractionId = spot.attractionId;
      }
      return cloned;
    }),
  }));
}
