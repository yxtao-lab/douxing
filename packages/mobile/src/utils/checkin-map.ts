import type { CheckInInfo } from '@douxing/shared';
import { mobileT } from '@/i18n/mobileT';
import { getDxPrimaryColorAlpha } from '@/utils/theme-colors';

export type CheckInTimeRange = 'all' | '7d' | '30d' | '90d';

export const CHECKIN_TIME_RANGE_OPTIONS: Array<{ key: CheckInTimeRange; labelKey: string }> = [
  { key: 'all', labelKey: 'checkins.rangeAll' },
  { key: '7d', labelKey: 'checkins.range7d' },
  { key: '30d', labelKey: 'checkins.range30d' },
  { key: '90d', labelKey: 'checkins.range90d' },
];

const RANGE_DAYS: Record<Exclude<CheckInTimeRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

/** 地图锚点尺寸（有照片时缩小默认图钉，突出上方缩略图） */
const PHOTO_CALLOUT_SIZE = 52;
const PHOTO_MARKER_SIZE = 48;

export function filterCheckInsByTimeRange(
  items: CheckInInfo[],
  range: CheckInTimeRange,
): CheckInInfo[] {
  if (range === 'all') return [...items];
  const days = RANGE_DAYS[range];
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return items.filter((item) => new Date(item.checkedAt).getTime() >= since);
}

export function getCheckInsWithCoords(items: CheckInInfo[]) {
  return items.filter(
    (item) => item.location.latitude != null && item.location.longitude != null,
  );
}

export type MapMarker = {
  id: number;
  latitude: number;
  longitude: number;
  title: string;
  width: number;
  height: number;
  iconPath?: string;
  photoUrl?: string;
  customCallout?: {
    anchorY: number;
    anchorX: number;
    display: 'ALWAYS' | 'BYCLICK';
  };
  callout?: {
    content: string;
    display: 'BYCLICK';
    padding: number;
    borderRadius: number;
    fontSize: number;
  };
};

export type MapPolyline = {
  points: Array<{ latitude: number; longitude: number }>;
  color: string;
  width: number;
  arrowLine: boolean;
};

export function buildMapMarkers(items: CheckInInfo[]): MapMarker[] {
  return getCheckInsWithCoords(items).map((item) => {
    const photoUrl = item.photos[0];
    const title = item.location.placeName || mobileT('checkins.mapMarkerFallback');
    const base = {
      id: item.id,
      latitude: item.location.latitude!,
      longitude: item.location.longitude!,
      title,
    };

    if (photoUrl) {
      return {
        ...base,
        photoUrl,
        width: 22,
        height: 22,
        customCallout: {
          anchorY: PHOTO_CALLOUT_SIZE + 6,
          anchorX: 0,
          display: 'ALWAYS' as const,
        },
      };
    }

    return {
      ...base,
      width: 28,
      height: 28,
      callout: {
        content: `${title}\n${mobileT('checkins.mapCalloutPoints', { points: item.pointsEarned })}`,
        display: 'BYCLICK' as const,
        padding: 8,
        borderRadius: 6,
        fontSize: 12,
      },
    };
  });
}

/** 带照片的标记（用于 map customCallout 气泡） */
export function getPhotoCalloutMarkers(markers: MapMarker[]) {
  return markers.filter((marker) => marker.photoUrl);
}

/** 非微信端降级：用照片作为 marker 图标 */
export function buildMapMarkersWithPhotoIcon(items: CheckInInfo[]): MapMarker[] {
  return buildMapMarkers(items).map((marker) => {
    if (!marker.photoUrl) return marker;
    return {
      ...marker,
      iconPath: marker.photoUrl,
      width: PHOTO_MARKER_SIZE,
      height: PHOTO_MARKER_SIZE,
      customCallout: undefined,
    };
  });
}

export function buildMapPolyline(items: CheckInInfo[]): MapPolyline[] {
  const sorted = [...getCheckInsWithCoords(items)].sort(
    (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime(),
  );
  if (sorted.length < 2) return [];

  return [
    {
      points: sorted.map((item) => ({
        latitude: item.location.latitude!,
        longitude: item.location.longitude!,
      })),
      color: getDxPrimaryColorAlpha('AA'),
      width: 4,
      arrowLine: true,
    },
  ];
}

export function buildIncludePoints(items: CheckInInfo[]) {
  return getCheckInsWithCoords(items).map((item) => ({
    latitude: item.location.latitude!,
    longitude: item.location.longitude!,
  }));
}

export const DEFAULT_MAP_CENTER = {
  latitude: 30.5728,
  longitude: 104.0668,
};

export function resolveMapCenter(items: CheckInInfo[]) {
  const withCoords = getCheckInsWithCoords(items);
  if (withCoords.length === 0) {
    return { ...DEFAULT_MAP_CENTER, scale: 10 };
  }

  const latSum = withCoords.reduce((sum, item) => sum + item.location.latitude!, 0);
  const lngSum = withCoords.reduce((sum, item) => sum + item.location.longitude!, 0);
  const count = withCoords.length;

  return {
    latitude: latSum / count,
    longitude: lngSum / count,
    scale: count === 1 ? 14 : count <= 3 ? 12 : 10,
  };
}

export function sumCheckInPoints(items: CheckInInfo[]) {
  return items.reduce((sum, item) => sum + item.pointsEarned, 0);
}

export function formatCheckInTime(iso: string) {
  return iso.replace('T', ' ').slice(0, 16);
}
