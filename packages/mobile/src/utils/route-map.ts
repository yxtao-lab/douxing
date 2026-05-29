import type { LatLng, RoutePath, RoutePathPoi } from '@douxing/shared';

export const ROUTE_TRAVELER_MARKER_ID = 900001;

/** 微信 map 组件 polyline.color 仅支持 #RRGGBB */
export const ROUTE_MAP_POLYLINE_COLOR = '#1677ff';

/** 微信小程序 map 高频更新 polyline 易触发渲染层 maxSimplifyZoom 异常 */
export function isMpWeixinMapPlatform(): boolean {
  // #ifdef MP-WEIXIN
  return true;
  // #endif
  return false;
}

export function isValidMapLatLng(point: LatLng): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180 &&
    !(point.latitude === 0 && point.longitude === 0)
  );
}

export function sanitizeMapPoints(points: LatLng[]): LatLng[] {
  return points.filter(isValidMapLatLng);
}

/** 控制折线点数，避免微信 map 内部抽稀逻辑崩溃 */
export function simplifyMapPolylinePoints(points: LatLng[], maxPoints = 120): LatLng[] {
  const valid = sanitizeMapPoints(points);
  if (valid.length <= maxPoints) return valid;
  const step = Math.ceil(valid.length / maxPoints);
  const simplified: LatLng[] = [];
  for (let i = 0; i < valid.length; i += step) {
    simplified.push(valid[i]!);
  }
  const last = valid[valid.length - 1]!;
  const tail = simplified[simplified.length - 1];
  if (tail?.latitude !== last.latitude || tail?.longitude !== last.longitude) {
    simplified.push(last);
  }
  return simplified;
}

export function clampMapScale(scale: number): number {
  if (!Number.isFinite(scale)) return DEFAULT_ROUTE_MAP_CENTER.scale;
  return Math.min(20, Math.max(3, Math.round(scale)));
}

export type RouteMapMarker = {
  id: number;
  latitude: number;
  longitude: number;
  title: string;
  width: number;
  height: number;
  label?: {
    content: string;
    color: string;
    fontSize: number;
    bgColor: string;
    borderRadius: number;
    padding: number;
  };
  callout?: {
    content: string;
    display: 'BYCLICK';
    padding: number;
    borderRadius: number;
    fontSize: number;
  };
};

export type RouteMapPolyline = {
  points: LatLng[];
  color: string;
  width: number;
  arrowLine: boolean;
};

export const DEFAULT_ROUTE_MAP_CENTER = {
  latitude: 30.5728,
  longitude: 104.0668,
  scale: 12,
};

function poiMarkerId(poi: RoutePathPoi): number {
  return poi.dayIndex * 1000 + poi.spotIndex + 1;
}

export function buildRoutePoiMarkers(pois: RoutePathPoi[]): RouteMapMarker[] {
  const validPois = pois.filter((poi) =>
    isValidMapLatLng({ latitude: poi.latitude, longitude: poi.longitude }),
  );
  return validPois.map((poi, index) => ({
    id: poiMarkerId(poi),
    latitude: poi.latitude,
    longitude: poi.longitude,
    title: poi.name,
    width: 24,
    height: 24,
    label: {
      content: String(index + 1),
      color: '#ffffff',
      fontSize: 11,
      bgColor: '#1677ff',
      borderRadius: 10,
      padding: 4,
    },
    callout: {
      content: poi.name,
      display: 'BYCLICK',
      padding: 8,
      borderRadius: 6,
      fontSize: 12,
    },
  }));
}

export function buildTravelerMarker(point: LatLng): RouteMapMarker {
  return {
    id: ROUTE_TRAVELER_MARKER_ID,
    latitude: point.latitude,
    longitude: point.longitude,
    title: '',
    width: 32,
    height: 32,
  };
}

export function buildRoutePolyline(
  points: LatLng[],
  color = ROUTE_MAP_POLYLINE_COLOR,
  options?: { arrowLine?: boolean },
): RouteMapPolyline[] {
  const safePoints = simplifyMapPolylinePoints(points);
  if (safePoints.length < 2) return [];
  const arrowLine = options?.arrowLine ?? !isMpWeixinMapPlatform();
  return [
    {
      points: safePoints,
      color,
      width: 5,
      arrowLine,
    },
  ];
}

export function buildRouteIncludePoints(points: LatLng[]): LatLng[] {
  return sanitizeMapPoints(points).map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
  }));
}

export function resolveRouteMapCenter(points: LatLng[]) {
  const safePoints = sanitizeMapPoints(points);
  if (safePoints.length === 0) {
    return { ...DEFAULT_ROUTE_MAP_CENTER };
  }
  if (safePoints.length === 1) {
    return {
      latitude: safePoints[0]!.latitude,
      longitude: safePoints[0]!.longitude,
      scale: clampMapScale(14),
    };
  }

  const latitudes = safePoints.map((point) => point.latitude);
  const longitudes = safePoints.map((point) => point.longitude);
  const latMin = Math.min(...latitudes);
  const latMax = Math.max(...latitudes);
  const lngMin = Math.min(...longitudes);
  const lngMax = Math.max(...longitudes);
  const span = Math.max(latMax - latMin, lngMax - lngMin);

  let scale = 12;
  if (span > 2) scale = 8;
  else if (span > 0.5) scale = 10;
  else if (span > 0.1) scale = 12;
  else scale = 14;

  return {
    latitude: latitudes.reduce((sum, lat) => sum + lat, 0) / latitudes.length,
    longitude: longitudes.reduce((sum, lng) => sum + lng, 0) / longitudes.length,
    scale: clampMapScale(scale),
  };
}

export function getRoutePathAnchorPoints(routePath: RoutePath): LatLng[] {
  return sanitizeMapPoints(
    routePath.pois.map((poi) => ({
      latitude: poi.latitude,
      longitude: poi.longitude,
    })),
  );
}
