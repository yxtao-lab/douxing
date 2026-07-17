import type { LocaleCode } from './types.js';
import { DEFAULT_LOCALE } from './constants.js';
import { normalizeSceneTags, type SceneTagSlug } from './scene-tags.js';

/** 性别（自愿填写） */
export type GenderSlug = 'male' | 'female' | 'other' | 'prefer_not_to_say';

/** 年龄段（不收集精确年龄） */
export type AgeRangeSlug = '18-22' | '23-30' | '31-40' | '41-50' | '50+';

/** 旅行半径 */
export type TravelRadiusSlug = 'local' | 'domestic' | 'global' | 'any';

/** 同伴结构 */
export type CompanionStructureSlug = 'solo' | 'couple' | 'family' | 'group';

/** 预算档次 */
export type BudgetTierSlug = 'budget' | 'mid-range' | 'premium' | 'luxury';

export const genderPresets: GenderSlug[] = ['male', 'female', 'other', 'prefer_not_to_say'];
export const ageRangePresets: AgeRangeSlug[] = ['18-22', '23-30', '31-40', '41-50', '50+'];
export const travelRadiusPresets: TravelRadiusSlug[] = ['local', 'domestic', 'global', 'any'];
export const companionStructurePresets: CompanionStructureSlug[] = [
  'solo',
  'couple',
  'family',
  'group',
];
export const budgetTierPresets: BudgetTierSlug[] = ['budget', 'mid-range', 'premium', 'luxury'];

const GENDER_SET = new Set<string>(genderPresets);
const AGE_RANGE_SET = new Set<string>(ageRangePresets);
const TRAVEL_RADIUS_SET = new Set<string>(travelRadiusPresets);
const COMPANION_SET = new Set<string>(companionStructurePresets);
const BUDGET_TIER_SET = new Set<string>(budgetTierPresets);

/** 引导跳过时的默认值（保证画像字段非空） */
export const ONBOARDING_DEFAULTS = {
  gender: 'prefer_not_to_say' as GenderSlug,
  ageRange: '23-30' as AgeRangeSlug,
  travelRadius: 'any' as TravelRadiusSlug,
  preferredScenes: ['kids', 'cool'] as SceneTagSlug[],
} as const;

const GENDER_LABELS: Record<LocaleCode, Record<GenderSlug, string>> = {
  'zh-CN': {
    male: '男',
    female: '女',
    other: '其他',
    prefer_not_to_say: '不愿透露',
  },
  'en-US': {
    male: 'Male',
    female: 'Female',
    other: 'Other',
    prefer_not_to_say: 'Prefer not to say',
  },
};

const AGE_RANGE_LABELS: Record<LocaleCode, Record<AgeRangeSlug, string>> = {
  'zh-CN': {
    '18-22': '18-22 大学生',
    '23-30': '23-30 职场新人',
    '31-40': '31-40 成家期',
    '41-50': '41-50 中年',
    '50+': '50+ 银发',
  },
  'en-US': {
    '18-22': '18-22 College',
    '23-30': '23-30 Early career',
    '31-40': '31-40 Family stage',
    '41-50': '41-50 Midlife',
    '50+': '50+ Senior',
  },
};

const TRAVEL_RADIUS_LABELS: Record<LocaleCode, Record<TravelRadiusSlug, string>> = {
  'zh-CN': {
    local: '城市周边',
    domestic: '国内长途',
    global: '全球旅行',
    any: '都喜欢',
  },
  'en-US': {
    local: 'Nearby getaways',
    domestic: 'Domestic trips',
    global: 'Global travel',
    any: 'All of the above',
  },
};

const COMPANION_LABELS: Record<LocaleCode, Record<CompanionStructureSlug, string>> = {
  'zh-CN': {
    solo: '独行',
    couple: '情侣',
    family: '家庭',
    group: '团体',
  },
  'en-US': {
    solo: 'Solo',
    couple: 'Couple',
    family: 'Family',
    group: 'Group',
  },
};

const BUDGET_TIER_LABELS: Record<LocaleCode, Record<BudgetTierSlug, string>> = {
  'zh-CN': {
    budget: '经济',
    'mid-range': '舒适',
    premium: '品质',
    luxury: '奢华',
  },
  'en-US': {
    budget: 'Budget',
    'mid-range': 'Comfort',
    premium: 'Premium',
    luxury: 'Luxury',
  },
};

/**
 * 判断是否为合法性别 slug。
 *
 * @param value - 待校验字符串
 * @returns 是否在 genderPresets 内
 */
export function isGenderSlug(value: string): value is GenderSlug {
  return GENDER_SET.has(value);
}

/**
 * 判断是否为合法年龄段 slug。
 *
 * @param value - 待校验字符串
 * @returns 是否在 ageRangePresets 内
 */
export function isAgeRangeSlug(value: string): value is AgeRangeSlug {
  return AGE_RANGE_SET.has(value);
}

/**
 * 判断是否为合法旅行半径 slug。
 *
 * @param value - 待校验字符串
 * @returns 是否在 travelRadiusPresets 内
 */
export function isTravelRadiusSlug(value: string): value is TravelRadiusSlug {
  return TRAVEL_RADIUS_SET.has(value);
}

/**
 * 判断是否为合法同伴结构 slug。
 *
 * @param value - 待校验字符串
 * @returns 是否在 companionStructurePresets 内
 */
export function isCompanionStructureSlug(value: string): value is CompanionStructureSlug {
  return COMPANION_SET.has(value);
}

/**
 * 判断是否为合法预算档次 slug。
 *
 * @param value - 待校验字符串
 * @returns 是否在 budgetTierPresets 内
 */
export function isBudgetTierSlug(value: string): value is BudgetTierSlug {
  return BUDGET_TIER_SET.has(value);
}

/**
 * 返回性别展示文案。
 *
 * @param slug - 性别 slug；非法则原样返回
 * @param locale - 语言
 * @returns 本地化文案
 */
export function formatGenderLabel(slug: string, locale: LocaleCode = DEFAULT_LOCALE): string {
  if (!isGenderSlug(slug)) return slug;
  return (GENDER_LABELS[locale] ?? GENDER_LABELS[DEFAULT_LOCALE])[slug];
}

/**
 * 返回年龄段展示文案。
 *
 * @param slug - 年龄段 slug；非法则原样返回
 * @param locale - 语言
 * @returns 本地化文案
 */
export function formatAgeRangeLabel(slug: string, locale: LocaleCode = DEFAULT_LOCALE): string {
  if (!isAgeRangeSlug(slug)) return slug;
  return (AGE_RANGE_LABELS[locale] ?? AGE_RANGE_LABELS[DEFAULT_LOCALE])[slug];
}

/**
 * 返回旅行半径展示文案。
 *
 * @param slug - 旅行半径 slug；非法则原样返回
 * @param locale - 语言
 * @returns 本地化文案
 */
export function formatTravelRadiusLabel(slug: string, locale: LocaleCode = DEFAULT_LOCALE): string {
  if (!isTravelRadiusSlug(slug)) return slug;
  return (TRAVEL_RADIUS_LABELS[locale] ?? TRAVEL_RADIUS_LABELS[DEFAULT_LOCALE])[slug];
}

/**
 * 返回同伴结构展示文案。
 *
 * @param slug - 同伴结构 slug；非法则原样返回
 * @param locale - 语言
 * @returns 本地化文案
 */
export function formatCompanionStructureLabel(
  slug: string,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  if (!isCompanionStructureSlug(slug)) return slug;
  return (COMPANION_LABELS[locale] ?? COMPANION_LABELS[DEFAULT_LOCALE])[slug];
}

/**
 * 返回预算档次展示文案。
 *
 * @param slug - 预算档次 slug；非法则原样返回
 * @param locale - 语言
 * @returns 本地化文案
 */
export function formatBudgetTierLabel(slug: string, locale: LocaleCode = DEFAULT_LOCALE): string {
  if (!isBudgetTierSlug(slug)) return slug;
  return (BUDGET_TIER_LABELS[locale] ?? BUDGET_TIER_LABELS[DEFAULT_LOCALE])[slug];
}

/**
 * 规整同伴结构列表：去重、过滤非法值。
 *
 * @param raw - 原始输入
 * @returns 合法 slug 数组
 */
export function normalizeCompanionStructure(raw: unknown): CompanionStructureSlug[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<CompanionStructureSlug>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!isCompanionStructureSlug(trimmed)) continue;
    seen.add(trimmed);
  }
  return [...seen];
}

/** 完成引导时提交的可选字段（跳过的字段由服务端填默认值） */
export interface CompleteOnboardingInput {
  gender?: string | null;
  ageRange?: string | null;
  travelRadius?: string | null;
  preferredScenes?: string[] | null;
  interestTags?: string[] | null;
  companionStructure?: string[] | null;
  budgetTier?: string | null;
  /** 为 true 时整步用默认值（整页跳过） */
  skipped?: boolean;
}

/** 引导完成后落库的规范化结果（字段均非空） */
export interface NormalizedOnboardingProfile {
  gender: GenderSlug;
  ageRange: AgeRangeSlug;
  travelRadius: TravelRadiusSlug;
  preferredScenes: SceneTagSlug[];
  companionStructure: CompanionStructureSlug[];
  budgetTier: BudgetTierSlug | null;
  interestTags: string[] | null;
}

/**
 * 将引导提交合并为非空画像：未选字段用 ONBOARDING_DEFAULTS。
 *
 * @param input - 前端提交；skipped=true 时全部用默认值
 * @returns 规范化后的引导结果（preferredScenes / 基础属性保证非空）
 */
export function normalizeOnboardingInput(input: CompleteOnboardingInput): NormalizedOnboardingProfile {
  if (input.skipped) {
    return {
      gender: ONBOARDING_DEFAULTS.gender,
      ageRange: ONBOARDING_DEFAULTS.ageRange,
      travelRadius: ONBOARDING_DEFAULTS.travelRadius,
      preferredScenes: [...ONBOARDING_DEFAULTS.preferredScenes],
      companionStructure: [],
      budgetTier: null,
      interestTags: null,
    };
  }

  const gender =
    typeof input.gender === 'string' && isGenderSlug(input.gender.trim())
      ? (input.gender.trim() as GenderSlug)
      : ONBOARDING_DEFAULTS.gender;

  const ageRange =
    typeof input.ageRange === 'string' && isAgeRangeSlug(input.ageRange.trim())
      ? (input.ageRange.trim() as AgeRangeSlug)
      : ONBOARDING_DEFAULTS.ageRange;

  const travelRadius =
    typeof input.travelRadius === 'string' && isTravelRadiusSlug(input.travelRadius.trim())
      ? (input.travelRadius.trim() as TravelRadiusSlug)
      : ONBOARDING_DEFAULTS.travelRadius;

  const preferredScenes = normalizeSceneTags(input.preferredScenes);
  const scenes =
    preferredScenes.length > 0 ? preferredScenes : [...ONBOARDING_DEFAULTS.preferredScenes];

  const companionStructure = normalizeCompanionStructure(input.companionStructure);

  const budgetTier =
    typeof input.budgetTier === 'string' && isBudgetTierSlug(input.budgetTier.trim())
      ? (input.budgetTier.trim() as BudgetTierSlug)
      : null;

  const interestTags =
    Array.isArray(input.interestTags) && input.interestTags.length > 0
      ? input.interestTags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      : null;

  return {
    gender,
    ageRange,
    travelRadius,
    preferredScenes: scenes,
    companionStructure,
    budgetTier,
    interestTags,
  };
}

/**
 * 判断用户是否尚未完成首次标签引导。
 *
 * @param onboardedAt - UserInfo.onboardedAt；null/undefined/空串视为未完成
 * @returns true 表示需要进入引导页
 */
export function needsOnboarding(onboardedAt: string | null | undefined): boolean {
  return onboardedAt == null || String(onboardedAt).trim() === '';
}
