import type { CheckInInfo } from './types.js';

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

export function buildCheckInPolylinePoints(items: CheckInInfo[]) {
  return [...getCheckInsWithCoords(items)]
    .sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime())
    .map((item) => ({
      lat: item.location.latitude!,
      lng: item.location.longitude!,
    }));
}

/** 默认全国视野（中国中心，zoom 4 可览全国） */
export const DEFAULT_CHECKIN_MAP_CENTER = {
  lat: 35.8617,
  lng: 104.1954,
  zoom: 4,
};

export function getDefaultChinaMapView() {
  return { ...DEFAULT_CHECKIN_MAP_CENTER };
}

export function resolveCheckInMapView(_items?: CheckInInfo[]) {
  return getDefaultChinaMapView();
}

export function sumCheckInPoints(items: CheckInInfo[]) {
  return items.reduce((sum, item) => sum + item.pointsEarned, 0);
}

export function formatCheckInTime(iso: string) {
  return iso.replace('T', ' ').slice(0, 16);
}
