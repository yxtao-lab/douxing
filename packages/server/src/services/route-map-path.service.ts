import {
  buildRoutePathForDay,
  buildRoutePathFromDetail,
  extractRouteDetailDays,
  type RouteDayPlan,
  type RoutePath,
  type RoutePathPoi,
  type RoutePathSegment,
  type RouteDetailPayload,
  type RouteTransitMode,
  type TravelRouteInfo,
} from '@douxing/shared';
import { isRouteUnlockPaymentRequired } from '../config/route-unlock.js';
import {
  getDirectionPolyline,
  type LatLngPoint,
} from './amap-direction.service.js';

export type BuildRouteMapPathOptions = {
  routeId?: number;
  name?: string;
};

function findTransitModeForSegment(
  days: RouteDayPlan[],
  fromPoi: RoutePathPoi,
  toPoi: RoutePathPoi,
): RouteTransitMode | null {
  if (fromPoi.dayIndex === toPoi.dayIndex) {
    const day = days[fromPoi.dayIndex];
    if (!day) return null;
    for (const seg of day.transit ?? []) {
      if (seg.kind === 'local' && seg.from === fromPoi.name && seg.to === toPoi.name) {
        return seg.mode;
      }
    }
    return null;
  }

  const destDay = days[toPoi.dayIndex];
  const intercity = destDay?.transit?.find((seg) => seg.kind === 'intercity');
  return intercity?.mode ?? null;
}

async function enrichSegmentWithPolyline(
  segment: RoutePathSegment,
  days: RouteDayPlan[],
  fromPoi: RoutePathPoi,
  toPoi: RoutePathPoi,
): Promise<RoutePathSegment> {
  const transitMode = findTransitModeForSegment(days, fromPoi, toPoi);
  const from: LatLngPoint = {
    latitude: segment.from.latitude,
    longitude: segment.from.longitude,
  };
  const to: LatLngPoint = {
    latitude: segment.to.latitude,
    longitude: segment.to.longitude,
  };

  const polyline = await getDirectionPolyline(from, to, transitMode);
  return {
    ...segment,
    points: polyline.points,
    mode: polyline.mode,
    estimated: polyline.estimated,
  };
}

function flattenSegmentPoints(segments: RoutePathSegment[]) {
  const fullPoints: Array<{ latitude: number; longitude: number }> = [];
  for (const segment of segments) {
    for (const point of segment.points) {
      const last = fullPoints[fullPoints.length - 1];
      if (
        last &&
        last.latitude === point.latitude &&
        last.longitude === point.longitude
      ) {
        continue;
      }
      fullPoints.push(point);
    }
  }
  return fullPoints;
}

/** H9-2：构建单日含高德 polyline 的路径（按天懒加载） */
export async function buildRouteMapPathForDay(
  routeDetail: RouteDetailPayload | Record<string, unknown> | null | undefined,
  dayIndex: number,
  options: BuildRouteMapPathOptions = {},
): Promise<RoutePath | null> {
  const base = buildRoutePathForDay(routeDetail, dayIndex, options);
  if (!base || base.segments.length === 0) return base;

  const days = extractRouteDetailDays(routeDetail);
  const enrichedSegments = await Promise.all(
    base.segments.map((segment, index) => {
      const fromPoi = base.pois[index];
      const toPoi = base.pois[index + 1];
      if (!fromPoi || !toPoi) return Promise.resolve(segment);
      return enrichSegmentWithPolyline(segment, days, fromPoi, toPoi);
    }),
  );

  return {
    ...base,
    segments: enrichedSegments,
    fullPoints: flattenSegmentPoints(enrichedSegments),
  };
}

/** H9-2：基于 routeDetail 构建含高德 polyline 的可播放路径 */
export async function buildRouteMapPathFromDetail(
  routeDetail: RouteDetailPayload | Record<string, unknown> | null | undefined,
  options: BuildRouteMapPathOptions = {},
): Promise<RoutePath | null> {
  const base = buildRoutePathFromDetail(routeDetail, options);
  if (!base || base.segments.length === 0) return base;

  const days = extractRouteDetailDays(routeDetail);
  const enrichedSegments = await Promise.all(
    base.segments.map((segment, index) => {
      const fromPoi = base.pois[index];
      const toPoi = base.pois[index + 1];
      if (!fromPoi || !toPoi) return Promise.resolve(segment);
      return enrichSegmentWithPolyline(segment, days, fromPoi, toPoi);
    }),
  );

  return {
    ...base,
    segments: enrichedSegments,
    fullPoints: flattenSegmentPoints(enrichedSegments),
  };
}

/** 判断用户是否可查看路线地图路径（与移动端解锁逻辑一致） */
export function canAccessRouteMapPath(route: TravelRouteInfo, userId: number): boolean {
  const isOwner = route.creatorId === userId;
  if (route.isPublic && !isOwner) return true;
  if (!isRouteUnlockPaymentRequired() && isOwner) return true;

  const detail = route.routeDetail as Record<string, unknown> | null;
  if (detail?.isUnlocked === true) return true;

  const unlockPrice = (detail?.unlockPrice as number) ?? route.unlockPrice ?? 0;
  return unlockPrice === 0;
}
