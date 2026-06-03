import type { LocaleCode } from './i18n/types.js';

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

/** 省 / 市两级数据（与 city_code 预设对齐，可动态补充「其他」） */
export const PROVINCE_CITY_REGIONS: ProvinceRegionMeta[] = [
  {
    code: 'beijing',
    nameZh: '北京',
    nameEn: 'Beijing',
    cities: [{ code: 'beijing', nameZh: '北京', nameEn: 'Beijing' }],
  },
  {
    code: 'shanghai',
    nameZh: '上海',
    nameEn: 'Shanghai',
    cities: [{ code: 'shanghai', nameZh: '上海', nameEn: 'Shanghai' }],
  },
  {
    code: 'chongqing',
    nameZh: '重庆',
    nameEn: 'Chongqing',
    cities: [{ code: 'chongqing', nameZh: '重庆', nameEn: 'Chongqing' }],
  },
  {
    code: 'zhejiang',
    nameZh: '浙江',
    nameEn: 'Zhejiang',
    cities: [{ code: 'hangzhou', nameZh: '杭州', nameEn: 'Hangzhou' }],
  },
  {
    code: 'sichuan',
    nameZh: '四川',
    nameEn: 'Sichuan',
    cities: [{ code: 'chengdu', nameZh: '成都', nameEn: 'Chengdu' }],
  },
  {
    code: 'shaanxi',
    nameZh: '陕西',
    nameEn: 'Shaanxi',
    cities: [{ code: 'xian', nameZh: '西安', nameEn: "Xi'an" }],
  },
  {
    code: 'guangdong',
    nameZh: '广东',
    nameEn: 'Guangdong',
    cities: [
      { code: 'guangzhou', nameZh: '广州', nameEn: 'Guangzhou' },
      { code: 'shenzhen', nameZh: '深圳', nameEn: 'Shenzhen' },
    ],
  },
  {
    code: 'fujian',
    nameZh: '福建',
    nameEn: 'Fujian',
    cities: [{ code: 'xiamen', nameZh: '厦门', nameEn: 'Xiamen' }],
  },
  {
    code: 'jiangsu',
    nameZh: '江苏',
    nameEn: 'Jiangsu',
    cities: [
      { code: 'nanjing', nameZh: '南京', nameEn: 'Nanjing' },
      { code: 'suzhou', nameZh: '苏州', nameEn: 'Suzhou' },
    ],
  },
  {
    code: 'hubei',
    nameZh: '湖北',
    nameEn: 'Hubei',
    cities: [{ code: 'wuhan', nameZh: '武汉', nameEn: 'Wuhan' }],
  },
  {
    code: 'hunan',
    nameZh: '湖南',
    nameEn: 'Hunan',
    cities: [{ code: 'changsha', nameZh: '长沙', nameEn: 'Changsha' }],
  },
  {
    code: 'shandong',
    nameZh: '山东',
    nameEn: 'Shandong',
    cities: [{ code: 'qingdao', nameZh: '青岛', nameEn: 'Qingdao' }],
  },
  {
    code: 'liaoning',
    nameZh: '辽宁',
    nameEn: 'Liaoning',
    cities: [{ code: 'dalian', nameZh: '大连', nameEn: 'Dalian' }],
  },
  {
    code: 'hainan',
    nameZh: '海南',
    nameEn: 'Hainan',
    cities: [{ code: 'sanya', nameZh: '三亚', nameEn: 'Sanya' }],
  },
  {
    code: 'yunnan',
    nameZh: '云南',
    nameEn: 'Yunnan',
    cities: [
      { code: 'lijiang', nameZh: '丽江', nameEn: 'Lijiang' },
      { code: 'kunming', nameZh: '昆明', nameEn: 'Kunming' },
    ],
  },
  {
    code: 'guangxi',
    nameZh: '广西',
    nameEn: 'Guangxi',
    cities: [{ code: 'guilin', nameZh: '桂林', nameEn: 'Guilin' }],
  },
];

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
