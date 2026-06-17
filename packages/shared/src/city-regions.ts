import type { LocaleCode } from './i18n/types.js';
import {
  buildNationalProvinceCityRegions,
  findNationalProvinceSlugByCityName,
  getNationalCityNamesByProvinceSlug,
} from './china-admin-divisions.js';

export interface CityRegionMeta {
  code: string;
  nameZh: string;
  nameEn: string;
}

export interface ProvinceRegionMeta {
  code: string;
  nameZh: string;
  nameEn: string;
  cities: CityRegionMeta[];
}

export interface CityCascaderOption {
  value: string;
  label: string;
  children?: CityCascaderOption[];
}

const OTHER_PROVINCE_CODE = 'other';

export { OTHER_PROVINCE_CODE };

/** 省 / 市两级（全国地级，基于 cn-division） */
export const PROVINCE_CITY_REGIONS: ProvinceRegionMeta[] = buildNationalProvinceCityRegions();

const KNOWN_CITY_CODES = new Set(
  PROVINCE_CITY_REGIONS.flatMap((province) => province.cities.map((city) => city.code)),
);

function pickLocalizedName(meta: { nameZh: string; nameEn: string }, locale: LocaleCode) {
  return locale === 'en-US' ? meta.nameEn : meta.nameZh;
}

export function findCityRegionByCode(cityCode: string): (CityRegionMeta & { provinceCode: string }) | undefined {
  for (const province of PROVINCE_CITY_REGIONS) {
    const city = province.cities.find((item) => item.code === cityCode);
    if (city) {
      return { ...city, provinceCode: province.code };
    }
  }
  return undefined;
}

/** 根据城市中文名（可带「市」后缀）查找所属省份 code — 全国地级 */
export function findProvinceCodeByCityName(cityName: string): string | undefined {
  return findNationalProvinceSlugByCityName(cityName);
}

/** 列出某省已知城市中文名（全国地级，用于 LLM 约束提示） */
export function getCityNamesByProvinceCode(provinceCode: string): string[] {
  return getNationalCityNamesByProvinceSlug(provinceCode);
}

export function getCityCodesInProvince(provinceCode: string): string[] {
  if (provinceCode === OTHER_PROVINCE_CODE) {
    return [];
  }
  const province = PROVINCE_CITY_REGIONS.find((item) => item.code === provinceCode);
  return province?.cities.map((city) => city.code) ?? [];
}

export interface DynamicCityEntry {
  cityCode: string;
  cityName?: string | null;
}

export function buildCityCascaderOptions(
  locale: LocaleCode,
  dynamicCities: DynamicCityEntry[] = [],
): CityCascaderOption[] {
  const options = PROVINCE_CITY_REGIONS.map((province) => ({
    value: province.code,
    label: pickLocalizedName(province, locale),
    children: province.cities.map((city) => ({
      value: city.code,
      label: pickLocalizedName(city, locale),
    })),
  }));

  const extraCities: CityRegionMeta[] = [];
  const seen = new Set<string>();

  for (const entry of dynamicCities) {
    const code = entry.cityCode?.trim();
    if (!code || seen.has(code) || KNOWN_CITY_CODES.has(code)) continue;
    seen.add(code);
    const name = entry.cityName?.trim() || code;
    extraCities.push({ code, nameZh: name, nameEn: name });
  }

  if (extraCities.length > 0) {
    options.push({
      value: OTHER_PROVINCE_CODE,
      label: locale === 'en-US' ? 'Other' : '其他',
      children: extraCities.map((city) => ({
        value: city.code,
        label: pickLocalizedName(city, locale),
      })),
    });
  }

  return options;
}

export function isKnownPresetCityCode(cityCode: string) {
  return KNOWN_CITY_CODES.has(cityCode);
}

export function resolveCityFilterFromPath(cityPath: string[]) {
  if (cityPath.length === 0) {
    return {};
  }
  if (cityPath.length === 1) {
    return { provinceCode: cityPath[0] };
  }
  return { cityCode: cityPath[cityPath.length - 1] };
}
