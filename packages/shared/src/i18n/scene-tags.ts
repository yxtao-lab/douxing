import type { LocaleCode } from './types.js';
import { DEFAULT_LOCALE } from './constants.js';

/**
 * 场景标签 slug（英文短码，作为存储值与 URL 段使用）。
 *
 * 与 interest-tags 不同：interest-tags 存中文值，scene-tags 存 slug，
 * 原因是场景标签为 P-TAG-01 新增维度，无历史包袱，slug 更利于 i18n、URL（/scenes/:slug）与检索。
 */
export type SceneTagSlug =
  | 'kids'
  | 'date'
  | 'water'
  | 'cool'
  | 'flower'
  | 'night'
  | 'summer-escape'
  | 'spring'
  | 'blessing'
  | 'camping';

/** 场景标签预设（slug 列表，顺序即首页 chip 展示顺序） */
export const sceneTagPresets: SceneTagSlug[] = [
  'kids',
  'date',
  'water',
  'cool',
  'flower',
  'night',
  'summer-escape',
  'spring',
  'blessing',
  'camping',
];

/** 场景标签 slug 集合（用于校验） */
export const SCENE_TAG_SET: Set<SceneTagSlug> = new Set(sceneTagPresets);

const SCENE_TAG_LABELS: Record<LocaleCode, Record<SceneTagSlug, string>> = {
  'zh-CN': {
    kids: '溜娃',
    date: '约会',
    water: '玩水',
    cool: '纳凉',
    flower: '赏花',
    night: '夜游',
    'summer-escape': '避暑',
    spring: '踏青',
    blessing: '祈福',
    camping: '露营',
  },
  'en-US': {
    kids: 'Family fun',
    date: 'Date',
    water: 'Water play',
    cool: 'Cool retreat',
    flower: 'Flower viewing',
    night: 'Night tour',
    'summer-escape': 'Summer escape',
    spring: 'Spring outing',
    blessing: 'Blessing',
    camping: 'Camping',
  },
};

/**
 * 判断给定字符串是否为合法的场景标签 slug。
 *
 * @param value - 待校验的字符串
 * @returns 是否在 `sceneTagPresets` 集合内
 */
export function isSceneTagSlug(value: string): value is SceneTagSlug {
  return SCENE_TAG_SET.has(value as SceneTagSlug);
}

/**
 * 返回单个场景标签的展示文案。
 *
 * @param slug - 场景标签 slug；非法 slug 原样返回，避免前端崩溃
 * @param locale - 语言；默认 `DEFAULT_LOCALE`
 * @returns 当前语言下的展示文案
 */
export function formatSceneTagLabel(slug: string, locale: LocaleCode = DEFAULT_LOCALE): string {
  if (!isSceneTagSlug(slug)) return slug;
  const table = SCENE_TAG_LABELS[locale] ?? SCENE_TAG_LABELS[DEFAULT_LOCALE];
  return table[slug] ?? slug;
}

/**
 * 拼接多个场景标签的展示文案。
 *
 * @param slugs - 场景标签 slug 列表；空或 null 返回空串
 * @param locale - 语言；默认 `DEFAULT_LOCALE`
 * @returns 当前语言下用分隔符拼接的文案（zh-CN 用「、」，en-US 用 `, `）
 */
export function joinSceneTagLabels(
  slugs: string[] | null | undefined,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  const list = slugs ?? [];
  if (list.length === 0) return '';
  const separator = locale === 'en-US' ? ', ' : '、';
  return list.map((slug) => formatSceneTagLabel(slug, locale)).join(separator);
}

/**
 * 规整场景标签 slug 数组：去空白、去重、过滤非法 slug。
 *
 * @param raw - 原始输入（可能来自 API body 或 DB）
 * @returns 合法且去重后的 slug 数组
 */
export function normalizeSceneTags(raw: unknown): SceneTagSlug[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<SceneTagSlug>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (!isSceneTagSlug(trimmed)) continue;
    seen.add(trimmed);
  }
  return [...seen];
}
