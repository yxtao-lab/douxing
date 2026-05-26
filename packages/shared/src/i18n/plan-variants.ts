import type { LocaleCode } from './types.js';
import { DEFAULT_LOCALE } from './constants.js';
import { formatMessage } from './format-message.js';

const PLAN_VARIANT_MESSAGES: Record<LocaleCode, Record<string, string>> = {
  'zh-CN': {
    'plan.variant.classic.label': '方案 A · 经典均衡',
    'plan.variant.classic.hint':
      '经典必游景点，每天 2～3 个节点，节奏均衡，适合首次到访',
    'plan.variant.culture.label': '方案 B · 文化深度',
    'plan.variant.culture.hint': '侧重博物馆、历史建筑、人文体验，减少购物点',
    'plan.variant.relaxed.label': '方案 C · 休闲轻松',
    'plan.variant.relaxed.hint': '节奏放缓，减少跨区赶路，留出下午茶或自由活动时间',
    'plan.variant.adventure.label': '方案 D · 小众探索',
    'plan.variant.adventure.hint': '侧重街区漫步、小众打卡与本地体验，避开过度拥挤景点',
    'plan.variant.premium.label': '方案 E · 品质优选',
    'plan.variant.premium.hint': '精选高口碑景点与品质餐饮，体验优先于打卡数量',
    'plan.variant.family.label': '方案 B · 亲子友好',
    'plan.variant.family.hint': '适合带娃：景点间距近、强度低、预留休息',
    'plan.variant.food.label': '方案 C · 美食探店',
    'plan.variant.food.hint': '突出特色餐厅、小吃街与市集，安排用餐时段',
    'plan.variant.romantic.label': '方案 C · 浪漫约会',
    'plan.variant.romantic.hint': '侧重夜景、江景、小众打卡与慢节奏体验',
    'plan.variant.outdoor.label': '方案 B · 户外自然',
    'plan.variant.outdoor.hint': '侧重自然风景、徒步或湿地等户外活动',
    'plan.variant.suffix.classic': '经典均衡',
    'plan.variant.suffix.culture': '文化深度',
    'plan.variant.suffix.relaxed': '休闲轻松',
    'plan.variant.suffix.adventure': '小众探索',
    'plan.variant.suffix.premium': '品质优选',
    'plan.variant.suffix.family': '亲子友好',
    'plan.variant.suffix.food': '美食探店',
    'plan.variant.suffix.romantic': '浪漫约会',
    'plan.variant.suffix.outdoor': '户外自然',
    'plan.variant.suffix.default': '精选',
  },
  'en-US': {
    'plan.variant.classic.label': 'Plan A · Classic balance',
    'plan.variant.classic.hint':
      'Must-see highlights, 2–3 stops per day, balanced pace for first-time visitors',
    'plan.variant.culture.label': 'Plan B · Culture focus',
    'plan.variant.culture.hint': 'Museums, heritage sites, and local culture; fewer shopping stops',
    'plan.variant.relaxed.label': 'Plan C · Relaxed pace',
    'plan.variant.relaxed.hint': 'Slower rhythm, less cross-town travel, time for cafés or free time',
    'plan.variant.adventure.label': 'Plan D · Off-the-beaten-path',
    'plan.variant.adventure.hint': 'Neighborhood walks, hidden gems, and local experiences',
    'plan.variant.premium.label': 'Plan E · Premium picks',
    'plan.variant.premium.hint': 'Top-rated sights and dining; quality over checklist quantity',
    'plan.variant.family.label': 'Plan B · Family-friendly',
    'plan.variant.family.hint': 'Kid-friendly: shorter hops, lighter days, breaks built in',
    'plan.variant.food.label': 'Plan C · Food tour',
    'plan.variant.food.hint': 'Signature restaurants, snack streets, and markets with meal slots',
    'plan.variant.romantic.label': 'Plan C · Romantic',
    'plan.variant.romantic.hint': 'Night views, waterfront strolls, and a slower couple-friendly pace',
    'plan.variant.outdoor.label': 'Plan B · Outdoors',
    'plan.variant.outdoor.hint': 'Nature, light hiking, wetlands, and outdoor activities',
    'plan.variant.suffix.classic': 'Classic',
    'plan.variant.suffix.culture': 'Culture',
    'plan.variant.suffix.relaxed': 'Relaxed',
    'plan.variant.suffix.adventure': 'Explorer',
    'plan.variant.suffix.premium': 'Premium',
    'plan.variant.suffix.family': 'Family',
    'plan.variant.suffix.food': 'Food',
    'plan.variant.suffix.romantic': 'Romantic',
    'plan.variant.suffix.outdoor': 'Outdoors',
    'plan.variant.suffix.default': 'Curated',
  },
};

function variantMsg(key: string, locale: LocaleCode): string {
  const table = PLAN_VARIANT_MESSAGES[locale] ?? PLAN_VARIANT_MESSAGES[DEFAULT_LOCALE];
  const fallback = PLAN_VARIANT_MESSAGES[DEFAULT_LOCALE];
  return table[key] ?? fallback[key] ?? key;
}

/** 候选方案卡片标签 */
export function formatPlanVariantLabel(
  variantKey: string | null | undefined,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  if (!variantKey) return '';
  return variantMsg(`plan.variant.${variantKey}.label`, locale);
}

/** 传给 LLM 的方案风格说明 */
export function formatPlanVariantHint(
  variantKey: string | null | undefined,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  if (!variantKey) return '';
  return variantMsg(`plan.variant.${variantKey}.hint`, locale);
}

/** 模板/RAG 路线标题中的风格后缀 */
export function formatPlanVariantSuffix(
  variantKey: string | null | undefined,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  if (!variantKey) return variantMsg('plan.variant.suffix.default', locale);
  const key = `plan.variant.suffix.${variantKey}`;
  const table = PLAN_VARIANT_MESSAGES[locale] ?? PLAN_VARIANT_MESSAGES[DEFAULT_LOCALE];
  const fallback = PLAN_VARIANT_MESSAGES[DEFAULT_LOCALE];
  return table[key] ?? fallback[key] ?? variantMsg('plan.variant.suffix.default', locale);
}
