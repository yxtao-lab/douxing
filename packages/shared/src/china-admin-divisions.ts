/**
 * 全国行政区划（省 + 地级）— 基于 cn-division（民政部 GB/T 2260）
 * 与业务 city_code（hangzhou / c4201）及 excludeProvinceCodes（hubei）桥接。
 */
import {
  citiesCode as cnCities,
  getCitiesByProvince,
  parseAddress,
  provincesCode as cnProvinces,
  type CityCode,
  type ProvinceCode,
} from 'cn-division';

/** 国标省级前 2 位 → 项目内 province slug（与 excludeProvinceCodes 对齐） */
export const GB_PROVINCE_SLUG_MAP: Record<
  string,
  { slug: string; nameZh: string; nameEn: string }
> = {
  '11': { slug: 'beijing', nameZh: '北京', nameEn: 'Beijing' },
  '12': { slug: 'tianjin', nameZh: '天津', nameEn: 'Tianjin' },
  '13': { slug: 'hebei', nameZh: '河北', nameEn: 'Hebei' },
  '14': { slug: 'shanxi', nameZh: '山西', nameEn: 'Shanxi' },
  '15': { slug: 'neimenggu', nameZh: '内蒙古', nameEn: 'Inner Mongolia' },
  '21': { slug: 'liaoning', nameZh: '辽宁', nameEn: 'Liaoning' },
  '22': { slug: 'jilin', nameZh: '吉林', nameEn: 'Jilin' },
  '23': { slug: 'heilongjiang', nameZh: '黑龙江', nameEn: 'Heilongjiang' },
  '31': { slug: 'shanghai', nameZh: '上海', nameEn: 'Shanghai' },
  '32': { slug: 'jiangsu', nameZh: '江苏', nameEn: 'Jiangsu' },
  '33': { slug: 'zhejiang', nameZh: '浙江', nameEn: 'Zhejiang' },
  '34': { slug: 'anhui', nameZh: '安徽', nameEn: 'Anhui' },
  '35': { slug: 'fujian', nameZh: '福建', nameEn: 'Fujian' },
  '36': { slug: 'jiangxi', nameZh: '江西', nameEn: 'Jiangxi' },
  '37': { slug: 'shandong', nameZh: '山东', nameEn: 'Shandong' },
  '41': { slug: 'henan', nameZh: '河南', nameEn: 'Henan' },
  '42': { slug: 'hubei', nameZh: '湖北', nameEn: 'Hubei' },
  '43': { slug: 'hunan', nameZh: '湖南', nameEn: 'Hunan' },
  '44': { slug: 'guangdong', nameZh: '广东', nameEn: 'Guangdong' },
  '45': { slug: 'guangxi', nameZh: '广西', nameEn: 'Guangxi' },
  '46': { slug: 'hainan', nameZh: '海南', nameEn: 'Hainan' },
  '50': { slug: 'chongqing', nameZh: '重庆', nameEn: 'Chongqing' },
  '51': { slug: 'sichuan', nameZh: '四川', nameEn: 'Sichuan' },
  '52': { slug: 'guizhou', nameZh: '贵州', nameEn: 'Guizhou' },
  '53': { slug: 'yunnan', nameZh: '云南', nameEn: 'Yunnan' },
  '54': { slug: 'xizang', nameZh: '西藏', nameEn: 'Tibet' },
  '61': { slug: 'shaanxi', nameZh: '陕西', nameEn: 'Shaanxi' },
  '62': { slug: 'gansu', nameZh: '甘肃', nameEn: 'Gansu' },
  '63': { slug: 'qinghai', nameZh: '青海', nameEn: 'Qinghai' },
  '64': { slug: 'ningxia', nameZh: '宁夏', nameEn: 'Ningxia' },
  '65': { slug: 'xinjiang', nameZh: '新疆', nameEn: 'Xinjiang' },
};

/** 历史业务 city_code，优先保留以兼容 attractions / 路线数据 */
const LEGACY_CITY_SLUG_BY_ZH: Record<string, string> = {
  北京: 'beijing',
  上海: 'shanghai',
  重庆: 'chongqing',
  天津: 'tianjin',
  杭州: 'hangzhou',
  成都: 'chengdu',
  西安: 'xian',
  广州: 'guangzhou',
  深圳: 'shenzhen',
  厦门: 'xiamen',
  南京: 'nanjing',
  苏州: 'suzhou',
  武汉: 'wuhan',
  宜昌: 'yichang',
  恩施: 'enshi',
  襄阳: 'xiangyang',
  黄石: 'huangshi',
  十堰: 'shiyan',
  荆州: 'jingzhou',
  神农架: 'shennongjia',
  长沙: 'changsha',
  青岛: 'qingdao',
  大连: 'dalian',
  三亚: 'sanya',
  丽江: 'lijiang',
  桂林: 'guilin',
  昆明: 'kunming',
};

const PROVINCE_SLUG_TO_GB = Object.fromEntries(
  Object.entries(GB_PROVINCE_SLUG_MAP).map(([gb, meta]) => [meta.slug, gb]),
);

const INVALID_PREFECTURE_NAMES = new Set(['县', '河南省', '湖北省', '海南省', '新疆维吾尔自治区']);

/** 归一化城市/地级名称，便于匹配 */
export function normalizeAdminCityName(raw: string): string {
  return raw
    .trim()
    .replace(/市$/, '')
    .replace(/土家族苗族自治州$/, '恩施')
    .replace(/藏族羌族自治州$/, '')
    .replace(/蒙古自治州$/, '')
    .replace(/回族自治州$/, '')
    .replace(/哈萨克自治州$/, '')
    .replace(/柯尔克孜自治州$/, '')
    .replace(/布依族苗族自治州$/, '')
    .replace(/苗族侗族自治州$/, '')
    .replace(/彝族自治州$/, '')
    .replace(/傣族自治州$/, '')
    .replace(/白族自治州$/, '')
    .replace(/傈僳族自治州$/, '')
    .replace(/朝鲜族自治州$/, '')
    .replace(/地区$/, '')
    .replace(/盟$/, '');
}

function gbProvinceCode(raw: string | number): string {
  return String(raw).padStart(2, '0').slice(0, 2);
}

function resolveCitySlug(city: CityCode): string {
  const short = normalizeAdminCityName(city.n);
  if (LEGACY_CITY_SLUG_BY_ZH[short]) return LEGACY_CITY_SLUG_BY_ZH[short]!;
  if (LEGACY_CITY_SLUG_BY_ZH[city.n.replace(/市$/, '')]) {
    return LEGACY_CITY_SLUG_BY_ZH[city.n.replace(/市$/, '')]!;
  }
  return `c${city.c}`;
}

function buildCityLookupMaps() {
  const nameToProvinceSlug = new Map<string, string>();
  const nameToCityCode = new Map<string, string>();

  for (const city of cnCities) {
    if (INVALID_PREFECTURE_NAMES.has(city.n)) continue;
    const provinceGb = gbProvinceCode(city.p);
    const provinceMeta = GB_PROVINCE_SLUG_MAP[provinceGb];
    if (!provinceMeta) continue;

    const slug = resolveCitySlug(city);
    const short = normalizeAdminCityName(city.n);
    const keys = new Set<string>([short, city.n.replace(/市$/, '')]);
    if (short.length >= 2) keys.add(short.slice(0, 2));

    for (const key of keys) {
      if (!key || key.length < 2) continue;
      if (!nameToProvinceSlug.has(key)) {
        nameToProvinceSlug.set(key, provinceMeta.slug);
      }
      if (!nameToCityCode.has(key)) {
        nameToCityCode.set(key, slug);
      }
    }
  }

  for (const [zh, slug] of Object.entries(LEGACY_CITY_SLUG_BY_ZH)) {
    if (!nameToCityCode.has(zh)) {
      nameToCityCode.set(zh, slug);
    }
  }

  return { nameToProvinceSlug, nameToCityCode };
}

const { nameToProvinceSlug, nameToCityCode } = buildCityLookupMaps();

export function getNationalProvinceSlugByGbCode(gbCode: string | number): string | undefined {
  return GB_PROVINCE_SLUG_MAP[gbProvinceCode(gbCode)]?.slug;
}

export function getNationalProvinceMetaBySlug(slug: string) {
  const gb = PROVINCE_SLUG_TO_GB[slug];
  if (!gb) return undefined;
  return GB_PROVINCE_SLUG_MAP[gb];
}

/** 根据城市中文名查所属省 slug（全国地级） */
export function findNationalProvinceSlugByCityName(cityName: string): string | undefined {
  const normalized = normalizeAdminCityName(cityName);
  if (!normalized) return undefined;

  const direct = nameToProvinceSlug.get(normalized);
  if (direct) return direct;

  const parsed = parseAddress(cityName);
  if (parsed?.province) {
    for (const province of cnProvinces) {
      if (parsed.province.includes(province.n.replace(/省|市|自治区|壮族|回族|维吾尔/g, ''))) {
        return GB_PROVINCE_SLUG_MAP[gbProvinceCode(province.c)]?.slug;
      }
    }
  }

  for (const [key, slug] of nameToProvinceSlug) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return slug;
    }
  }
  return undefined;
}

/** 解析城市名为业务 city_code */
export function resolveNationalCityCode(cityName: string): string | undefined {
  const normalized = normalizeAdminCityName(cityName);
  if (!normalized) return undefined;
  return nameToCityCode.get(normalized)
    ?? [...nameToCityCode.entries()].find(([k]) => normalized.includes(k) || k.includes(normalized))?.[1];
}

/** 列出某省全部地级城市中文名（全国） */
export function getNationalCityNamesByProvinceSlug(provinceSlug: string): string[] {
  const gb = PROVINCE_SLUG_TO_GB[provinceSlug];
  if (!gb) return [];
  return getCitiesByProvince(gb)
    .filter((city) => !INVALID_PREFECTURE_NAMES.has(city.n))
    .map((city) => normalizeAdminCityName(city.n));
}

export function buildNationalProvinceCityRegions(): Array<{
  code: string;
  nameZh: string;
  nameEn: string;
  cities: Array<{ code: string; nameZh: string; nameEn: string }>;
}> {
  return cnProvinces
    .map((province: ProvinceCode) => {
      const gb = gbProvinceCode(province.c);
      const meta = GB_PROVINCE_SLUG_MAP[gb];
      if (!meta) return null;
      const cities = getCitiesByProvince(gb)
        .filter((city) => !INVALID_PREFECTURE_NAMES.has(city.n))
        .map((city) => ({
          code: resolveCitySlug(city),
          nameZh: normalizeAdminCityName(city.n),
          nameEn: normalizeAdminCityName(city.n),
        }));
      return {
        code: meta.slug,
        nameZh: meta.nameZh,
        nameEn: meta.nameEn,
        cities,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
}

/** 省级 slug → DataV/ECharts 六位 adcode（如 zhejiang → 330000） */
export function getProvinceAdcodeBySlug(provinceSlug: string): string | undefined {
  const gb = PROVINCE_SLUG_TO_GB[provinceSlug];
  if (!gb) return undefined;
  return `${gb}0000`;
}

/** 省级中文简称 → GeoJSON 面名称（如 浙江 → 浙江省） */
export function getProvinceGeoMapName(nameZh: string): string {
  if (nameZh === '内蒙古') return '内蒙古自治区';
  if (nameZh === '广西') return '广西壮族自治区';
  if (nameZh === '西藏') return '西藏自治区';
  if (nameZh === '宁夏') return '宁夏回族自治区';
  if (nameZh === '新疆') return '新疆维吾尔自治区';
  if (nameZh === '香港') return '香港特别行政区';
  if (nameZh === '澳门') return '澳门特别行政区';
  if (['北京', '天津', '上海', '重庆'].includes(nameZh)) return `${nameZh}市`;
  return `${nameZh}省`;
}

/** 构建中文名 → city_code 全量映射（含全国地级） */
export function buildNationalCityCodeMap(): Record<string, string> {
  const map: Record<string, string> = { ...LEGACY_CITY_SLUG_BY_ZH };
  for (const city of cnCities) {
    if (INVALID_PREFECTURE_NAMES.has(city.n)) continue;
    const slug = resolveCitySlug(city);
    const short = normalizeAdminCityName(city.n);
    if (!map[short]) map[short] = slug;
    const withSuffix = city.n.replace(/市$/, '');
    if (!map[withSuffix]) map[withSuffix] = slug;
  }
  return map;
}

export { cnProvinces, cnCities, parseAddress };
