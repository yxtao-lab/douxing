import type { CheckInInfo } from './types.js';
import { isKnownPresetCityCode, OTHER_PROVINCE_CODE } from './city-regions.js';

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

export interface CheckInMapFilterQuery {
  provinceCode?: string;
  cityCode?: string;
  cityName?: string;
  placeName?: string;
  timeStart?: string;
  timeEnd?: string;
}

function normalizeFuzzyKeyword(keyword: string) {
  return keyword.trim().toLowerCase();
}

function matchesFuzzy(text: string | null | undefined, keyword: string) {
  if (!keyword) return true;
  if (!text) return false;
  return text.toLowerCase().includes(keyword);
}

function parseFilterDateBoundary(value: string | undefined, boundary: 'start' | 'end') {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  if (dateOnly) {
    const [year, month, day] = trimmed.split('-').map(Number);
    if (boundary === 'start') {
      return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
    }
    return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  }
  const ts = new Date(trimmed).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function matchesCityFilter(
  item: CheckInInfo,
  query: Pick<CheckInMapFilterQuery, 'provinceCode' | 'cityCode' | 'cityName'>,
  provinceCityCodes: string[],
) {
  if (query.cityCode) {
    if (item.cityCode === query.cityCode) return true;
    if (query.cityName && matchesFuzzy(item.city, query.cityName)) return true;
    return false;
  }

  if (query.provinceCode) {
    if (query.provinceCode === OTHER_PROVINCE_CODE) {
      return Boolean(item.cityCode && !isKnownPresetCityCode(item.cityCode));
    }
    if (item.cityCode && provinceCityCodes.includes(item.cityCode)) return true;
    return false;
  }

  return true;
}

/** 按城市、景点、起止时间过滤（AND 组合，空字段忽略；时间可只填起始或结束） */
export function filterCheckInsByMapQuery(
  items: CheckInInfo[],
  query: CheckInMapFilterQuery,
  provinceCityCodes: string[] = [],
): CheckInInfo[] {
  const placeKeyword = normalizeFuzzyKeyword(query.placeName ?? '');
  const timeStart = parseFilterDateBoundary(query.timeStart, 'start');
  const timeEnd = parseFilterDateBoundary(query.timeEnd, 'end');
  const hasCityFilter = Boolean(query.cityCode || query.provinceCode);

  if (!hasCityFilter && !placeKeyword && timeStart == null && timeEnd == null) {
    return [...items];
  }

  return items.filter((item) => {
    if (hasCityFilter && !matchesCityFilter(item, query, provinceCityCodes)) {
      return false;
    }

    if (placeKeyword && !matchesFuzzy(item.location.placeName, placeKeyword)) {
      return false;
    }

    const checkedAt = new Date(item.checkedAt).getTime();
    if (timeStart != null && checkedAt < timeStart) return false;
    if (timeEnd != null && checkedAt > timeEnd) return false;

    return true;
  });
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

/** 全国地图 fitBounds 范围（与海报中国陆域范围一致） */
export const CHINA_MAP_GEO_BOUNDS = {
  south: 18.0,
  west: 73.62,
  north: 53.5,
  east: 135.04,
} as const;

export type ChinaMapLatLngBounds = [[number, number], [number, number]];

export function getChinaMapBounds(): ChinaMapLatLngBounds {
  return [
    [CHINA_MAP_GEO_BOUNDS.south, CHINA_MAP_GEO_BOUNDS.west],
    [CHINA_MAP_GEO_BOUNDS.north, CHINA_MAP_GEO_BOUNDS.east],
  ];
}

export function getDefaultChinaMapView() {
  return { ...DEFAULT_CHECKIN_MAP_CENTER };
}

export function resolveCheckInMapView(_items?: CheckInInfo[]) {
  return getDefaultChinaMapView();
}

export function sumCheckInPoints(items: CheckInInfo[]) {
  return items.reduce((sum, item) => sum + item.pointsEarned, 0);
}

import { formatDisplayDateTime } from './display-datetime.js';

/**
 * 格式化打卡时间用于列表、地图等用户可见展示。
 *
 * @param iso - ISO 或 API 返回的时间字符串
 * @returns `yyyy-mm-dd HH:mm:ss`；无法解析时回退原串
 */
export function formatCheckInTime(iso: string) {
  return formatDisplayDateTime(iso) || iso;
}
