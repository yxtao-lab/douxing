import { buildNationalCityCodeMap } from '@douxing/shared';

/** 城市中文名 → city_code（全国地级 + 历史业务 slug） */
export const CITY_CODE_MAP: Record<string, string> = buildNationalCityCodeMap();

export function resolveCityCode(city: string): string {
  const trimmed = city.trim().replace(/市$/, '');
  if (CITY_CODE_MAP[trimmed]) return CITY_CODE_MAP[trimmed]!;
  if (CITY_CODE_MAP[city.trim()]) return CITY_CODE_MAP[city.trim()]!;
  return trimmed
    .toLowerCase()
    .replace(/\s+/g, '')
    .slice(0, 32) || 'unknown';
}
