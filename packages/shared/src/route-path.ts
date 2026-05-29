import type { RouteDayAttraction, RouteDayPlan, RouteDetailPayload } from './types.js';

export type LatLng = { latitude: number; longitude: number };

export type RoutePathPoi = LatLng & {
  name: string;
  dayIndex: number;
  spotIndex: number;
  poiType?: string;
};

export type RoutePathSegmentMode = 'walk' | 'drive' | 'straight';

export type RoutePathSegment = {
  routeId?: number;
  dayIndex: number;
  fromSpotIndex: number;
  toSpotIndex: number;
  from: LatLng;
  to: LatLng;
  points: LatLng[];
  mode: RoutePathSegmentMode;
  /** H9-2：高德不可用时为 true（直线/估算路段） */
  estimated?: boolean;
};

export type RoutePath = {
  routeId?: number;
  name?: string;
  /** 按天预览时的日程索引（0-based） */
  dayIndex?: number;
  /** 行程日期（ISO 或展示用字符串，便于与开放政策关联） */
  date?: string;
  pois: RoutePathPoi[];
  segments: RoutePathSegment[];
  fullPoints: LatLng[];
  hiddenSpotCount: number;
  totalSpotCount: number;
};

export type BuildRoutePathOptions = {
  routeId?: number;
  name?: string;
  /** 直线段插值点数，越大动画越平滑 */
  interpolateSteps?: number;
};

function hasValidCoords(spot: RouteDayAttraction): boolean {
  return (
    spot.latitude != null &&
    spot.longitude != null &&
    !(spot.latitude === 0 && spot.longitude === 0)
  );
}

/** 从 routeDetail 中提取 days（兼容嵌套与 loose 类型） */
export function extractRouteDetailDays(
  routeDetail: RouteDetailPayload | Record<string, unknown> | null | undefined,
): RouteDayPlan[] {
  if (!routeDetail || typeof routeDetail !== 'object') return [];
  const rd = routeDetail as Record<string, unknown>;
  if (Array.isArray(rd.days)) {
    return rd.days as RouteDayPlan[];
  }
  const nested = rd.routeDetail;
  if (nested && typeof nested === 'object') {
    const nestedDays = (nested as Record<string, unknown>).days;
    if (Array.isArray(nestedDays)) {
      return nestedDays as RouteDayPlan[];
    }
  }
  return [];
}

/** 在两点间线性插值，生成更密集的路径点 */
export function interpolateSegment(from: LatLng, to: LatLng, steps = 20): LatLng[] {
  const safeSteps = Math.max(2, steps);
  const points: LatLng[] = [];
  for (let i = 0; i < safeSteps; i += 1) {
    const t = i / (safeSteps - 1);
    points.push({
      latitude: from.latitude + (to.latitude - from.latitude) * t,
      longitude: from.longitude + (to.longitude - from.longitude) * t,
    });
  }
  return points;
}

function flattenSegmentPoints(segments: RoutePathSegment[]): LatLng[] {
  const fullPoints: LatLng[] = [];
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

function buildStraightSegment(
  from: RoutePathPoi,
  to: RoutePathPoi,
  routeId: number | undefined,
  interpolateSteps: number,
): RoutePathSegment {
  return {
    routeId,
    dayIndex: from.dayIndex,
    fromSpotIndex: from.spotIndex,
    toSpotIndex: to.spotIndex,
    from: { latitude: from.latitude, longitude: from.longitude },
    to: { latitude: to.latitude, longitude: to.longitude },
    points: interpolateSegment(from, to, interpolateSteps),
    mode: 'straight',
  };
}

function isMapPoi(spot: RouteDayAttraction): boolean {
  if (!hasValidCoords(spot)) return false;
  const type = spot.poiType ?? 'attraction';
  return type === 'attraction' || type === 'hotel';
}

type RoutePathBuildStats = {
  totalSpotCount: number;
  hiddenSpotCount: number;
};

function collectPoisForDay(
  day: RouteDayPlan,
  dayIndex: number,
  stats: RoutePathBuildStats,
): RoutePathPoi[] {
  const pois: RoutePathPoi[] = [];
  for (let spotIndex = 0; spotIndex < day.attractions.length; spotIndex += 1) {
    const spot = day.attractions[spotIndex]!;
    stats.totalSpotCount += 1;
    if (!isMapPoi(spot)) {
      stats.hiddenSpotCount += 1;
      continue;
    }
    pois.push({
      latitude: spot.latitude!,
      longitude: spot.longitude!,
      name: spot.name,
      dayIndex,
      spotIndex,
      poiType: spot.poiType,
    });
  }
  const lodging = day.lodging;
  if (lodging?.latitude != null && lodging.longitude != null) {
    stats.totalSpotCount += 1;
    pois.push({
      latitude: lodging.latitude,
      longitude: lodging.longitude,
      name: lodging.name,
      dayIndex,
      spotIndex: day.attractions.length,
      poiType: 'hotel',
    });
  }
  return pois;
}

function buildPathFromPois(
  pois: RoutePathPoi[],
  stats: RoutePathBuildStats,
  options: BuildRoutePathOptions,
  meta?: { dayIndex?: number; date?: string },
): RoutePath | null {
  if (pois.length < 2) return null;
  const interpolateSteps = options.interpolateSteps ?? 20;
  const segments = pois.slice(0, -1).map((from, index) => {
    const to = pois[index + 1]!;
    return buildStraightSegment(from, to, options.routeId, interpolateSteps);
  });
  return {
    routeId: options.routeId,
    name: options.name,
    dayIndex: meta?.dayIndex,
    date: meta?.date,
    pois,
    segments,
    fullPoints: flattenSegmentPoints(segments),
    hiddenSpotCount: stats.hiddenSpotCount,
    totalSpotCount: stats.totalSpotCount,
  };
}

/** 构建单日可播放路径（不含跨天连线） */
export function buildRoutePathForDay(
  routeDetail: RouteDetailPayload | Record<string, unknown> | null | undefined,
  dayIndex: number,
  options: BuildRoutePathOptions = {},
): RoutePath | null {
  const days = extractRouteDetailDays(routeDetail);
  const day = days[dayIndex];
  if (!day) return null;

  const stats: RoutePathBuildStats = { totalSpotCount: 0, hiddenSpotCount: 0 };
  const pois = collectPoisForDay(day, dayIndex, stats);
  return buildPathFromPois(pois, stats, options, {
    dayIndex,
    date: day.date?.trim() || undefined,
  });
}

/** 从单条路线 detail 构建可播放路径（MVP：POI 间直线插值；含有坐标 hotel） */
export function buildRoutePathFromDetail(
  routeDetail: RouteDetailPayload | Record<string, unknown> | null | undefined,
  options: BuildRoutePathOptions = {},
): RoutePath | null {
  const days = extractRouteDetailDays(routeDetail);
  if (days.length === 0) return null;

  const stats: RoutePathBuildStats = { totalSpotCount: 0, hiddenSpotCount: 0 };
  const pois: RoutePathPoi[] = [];

  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    pois.push(...collectPoisForDay(days[dayIndex]!, dayIndex, stats));
  }

  return buildPathFromPois(pois, stats, options);
}

/** 合并多条路线为一条连续路径（后期「整体足迹动画」使用） */
export function mergeRoutePaths(paths: RoutePath[]): RoutePath | null {
  const validPaths = paths.filter((path) => path.fullPoints.length >= 2);
  if (validPaths.length === 0) return null;
  if (validPaths.length === 1) return validPaths[0]!;

  const segments = validPaths.flatMap((path) => path.segments);
  const pois = validPaths.flatMap((path) => path.pois);

  return {
    pois,
    segments,
    fullPoints: flattenSegmentPoints(segments),
    hiddenSpotCount: validPaths.reduce((sum, path) => sum + path.hiddenSpotCount, 0),
    totalSpotCount: validPaths.reduce((sum, path) => sum + path.totalSpotCount, 0),
  };
}
