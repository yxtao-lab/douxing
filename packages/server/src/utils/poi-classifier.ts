import { PoiCategory } from '@douxing/shared';
import type { RouteDayAttraction } from '@douxing/shared';

/** 笼统餐饮/休息描述，无具体店名 — 不入库 */
const GENERIC_MEAL_NAMES = [
  '午餐',
  '晚饭',
  '晚餐',
  '早餐',
  '早饭',
  '早点',
  '吃饭',
  '用膳',
  '用餐',
  '自行用餐',
  '自由用餐',
  '美食体验',
  '品尝美食',
  '当地美食',
  '特色小吃',
  '推荐美食',
  '午餐休息',
  '晚餐休息',
];

/** 笼统住宿描述 — 不入库 */
const GENERIC_STAY_NAMES = [
  '入住酒店',
  '酒店入住',
  '住宿',
  '回酒店',
  '酒店休息',
  '入住酒店休息',
  '返回酒店',
];

/** 交通/其他活动 — 不入库 */
const NON_POI_TYPES = new Set<string>([
  PoiCategory.MEAL,
  PoiCategory.TRANSPORT,
  PoiCategory.OTHER,
]);

const RESTAURANT_HINTS = ['餐厅', '饭店', '酒楼', '食堂', '面馆', '火锅', '烧烤', '小吃店', '茶餐厅', '咖啡厅', '咖啡馆'];
const HOTEL_HINTS = ['酒店', '宾馆', '旅馆', '民宿', '客栈', '青旅', '度假村'];

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, '');
}

function matchesGenericList(name: string, list: string[]): boolean {
  const n = normalizeName(name);
  if (n.length < 2) return true;
  return list.some((g) => n === g || n.includes(g) && n.length <= g.length + 4);
}

/** 从名称推断 POI 类型（模板路线、旧数据无 poiType 时） */
export function inferPoiCategory(name: string, description?: string): string {
  const text = `${name} ${description ?? ''}`;
  if (matchesGenericList(name, GENERIC_MEAL_NAMES)) return PoiCategory.MEAL;
  if (matchesGenericList(name, GENERIC_STAY_NAMES)) return PoiCategory.OTHER;

  if (HOTEL_HINTS.some((h) => text.includes(h)) && !matchesGenericList(name, GENERIC_STAY_NAMES)) {
    return PoiCategory.HOTEL;
  }
  if (RESTAURANT_HINTS.some((h) => text.includes(h)) && !matchesGenericList(name, GENERIC_MEAL_NAMES)) {
    return PoiCategory.RESTAURANT;
  }
  return PoiCategory.ATTRACTION;
}

export function resolvePoiCategory(spot: RouteDayAttraction): string {
  if (spot.poiType?.trim()) return spot.poiType.trim();
  return inferPoiCategory(spot.name, spot.description);
}

/** 是否应写入 attractions 表 */
export function shouldSyncSpotToAttractions(spot: RouteDayAttraction): boolean {
  const category = resolvePoiCategory(spot);
  if (NON_POI_TYPES.has(category)) return false;
  if (category === PoiCategory.MEAL) return false;

  if (category === PoiCategory.RESTAURANT || category === PoiCategory.HOTEL) {
    if (matchesGenericList(spot.name, GENERIC_MEAL_NAMES)) return false;
    if (matchesGenericList(spot.name, GENERIC_STAY_NAMES)) return false;
    const n = normalizeName(spot.name);
    if (n.length < 3) return false;
    return true;
  }

  if (category === PoiCategory.ATTRACTION) {
    if (matchesGenericList(spot.name, GENERIC_MEAL_NAMES)) return false;
    return normalizeName(spot.name).length >= 2;
  }

  return false;
}

/** 景点类入库时是否具备可用坐标 */
export function hasValidCoordinates(spot: RouteDayAttraction): boolean {
  const lat = spot.latitude;
  const lng = spot.longitude;
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

/** 景点类新建入库前必须有坐标（饭店/酒店可暂无，待地图 API 补全） */
export function requiresCoordinatesForInsert(category: string): boolean {
  return category === PoiCategory.ATTRACTION;
}

export function mapPoiCategoryToDbCategory(poiType: string): string {
  if (poiType === PoiCategory.RESTAURANT) return PoiCategory.RESTAURANT;
  if (poiType === PoiCategory.HOTEL) return PoiCategory.HOTEL;
  return PoiCategory.ATTRACTION;
}

export function defaultTagsForCategory(category: string, routeTags: string[]): string[] {
  const base = [...routeTags];
  if (category === PoiCategory.RESTAURANT && !base.includes('美食')) base.push('美食');
  if (category === PoiCategory.HOTEL && !base.includes('住宿')) base.push('住宿');
  if (category === PoiCategory.ATTRACTION && base.length === 0) base.push('休闲');
  return base;
}
