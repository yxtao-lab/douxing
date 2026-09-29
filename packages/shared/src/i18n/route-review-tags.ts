import type { LocaleCode } from './types.js';
import { DEFAULT_LOCALE } from './constants.js';

/**
 * U2：路线评价结构化标签 slug（评论层，对齐 H10 点评能力升维到整条路线）。
 */
export type RouteReviewTagSlug =
  | 'easy_walk'
  | 'long_queue'
  | 'family_friendly'
  | 'food_good'
  | 'value_money'
  | 'scenic'
  | 'crowded'
  | 'worth_revisit';

/** 评价标签预设（顺序即发表评论时 chip 展示顺序） */
export const routeReviewTagPresets: RouteReviewTagSlug[] = [
  'easy_walk',
  'long_queue',
  'family_friendly',
  'food_good',
  'value_money',
  'scenic',
  'crowded',
  'worth_revisit',
];

/** 评价标签合法集合 */
export const ROUTE_REVIEW_TAG_SET: Set<RouteReviewTagSlug> = new Set(routeReviewTagPresets);

/** 单条评论最多可挂评价标签数 */
export const ROUTE_REVIEW_TAG_MAX = 5;

/** 可选星级范围 */
export const ROUTE_REVIEW_RATING_MIN = 1;
export const ROUTE_REVIEW_RATING_MAX = 5;

const ROUTE_REVIEW_TAG_LABELS: Record<LocaleCode, Record<RouteReviewTagSlug, string>> = {
  'zh-CN': {
    easy_walk: '好走',
    long_queue: '排队久',
    family_friendly: '适合亲子',
    food_good: '美食多',
    value_money: '性价比高',
    scenic: '风景好',
    crowded: '人多拥挤',
    worth_revisit: '值得再去',
  },
  'en-US': {
    easy_walk: 'Easy walk',
    long_queue: 'Long queues',
    family_friendly: 'Family friendly',
    food_good: 'Great food',
    value_money: 'Good value',
    scenic: 'Scenic',
    crowded: 'Crowded',
    worth_revisit: 'Worth revisit',
  },
};

/**
 * 判断是否为合法路线评价标签 slug。
 *
 * @param value - 待校验值
 * @returns 是否合法
 */
export function isRouteReviewTagSlug(value: unknown): value is RouteReviewTagSlug {
  return typeof value === 'string' && ROUTE_REVIEW_TAG_SET.has(value as RouteReviewTagSlug);
}

/**
 * 规范化评价标签列表：去重、过滤非法、截断上限。
 *
 * @param tags - 原始标签
 * @returns 合法 slug 列表
 */
export function normalizeRouteReviewTags(tags: unknown): RouteReviewTagSlug[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<RouteReviewTagSlug>();
  const result: RouteReviewTagSlug[] = [];
  for (const item of tags) {
    if (!isRouteReviewTagSlug(item) || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= ROUTE_REVIEW_TAG_MAX) break;
  }
  return result;
}

/**
 * 校验可选星级；非法时返回 null（表示未评分）。
 *
 * @param value - 原始值
 * @returns 1～5 或 null；非法数字返回 `undefined` 供调用方抛错
 */
export function parseRouteReviewRating(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  const rating = Math.floor(n);
  if (rating < ROUTE_REVIEW_RATING_MIN || rating > ROUTE_REVIEW_RATING_MAX) return undefined;
  return rating;
}

/**
 * 返回评价标签展示文案。
 *
 * @param slug - 标签 slug；非法时原样返回
 * @param locale - 语言
 * @returns 展示文案
 */
export function formatRouteReviewTagLabel(
  slug: string,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  if (!isRouteReviewTagSlug(slug)) return slug;
  return ROUTE_REVIEW_TAG_LABELS[locale]?.[slug] ?? ROUTE_REVIEW_TAG_LABELS[DEFAULT_LOCALE][slug];
}
