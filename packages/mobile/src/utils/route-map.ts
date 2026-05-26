import type { LatLng, RoutePath, RoutePathPoi } from '@douxing/shared';

export const ROUTE_TRAVELER_MARKER_ID = 900001;

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
  return pois.map((poi, index) => ({
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

export function buildRoutePolyline(points: LatLng[], color = '#1677ff'): RouteMapPolyline[] {
  if (points.length < 2) return [];
  return [
    {
      points,
      color: `${color}CC`,
      width: 5,
      arrowLine: true,
    },
  ];
}

export function buildRouteIncludePoints(points: LatLng[]): LatLng[] {
  return points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
  }));
}

export function resolveRouteMapCenter(points: LatLng[]) {
  if (points.length === 0) {
    return { ...DEFAULT_ROUTE_MAP_CENTER };
  }
  if (points.length === 1) {
    return {
      latitude: points[0]!.latitude,
      longitude: points[0]!.longitude,
      scale: 14,
    };
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
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
    scale,
  };
}

export function getRoutePathAnchorPoints(routePath: RoutePath): LatLng[] {
  return routePath.pois.map((poi) => ({
    latitude: poi.latitude,
    longitude: poi.longitude,
  }));
}
