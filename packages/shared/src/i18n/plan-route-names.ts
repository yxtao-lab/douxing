import type { LocaleCode } from './types.js';
import { DEFAULT_LOCALE } from './constants.js';
import { formatMessage } from './format-message.js';
import { formatInterestTagLabel } from './interest-tags.js';
import { formatPlanVariantSuffix } from './plan-variants.js';

const ROUTE_NAME_MESSAGES: Record<LocaleCode, Record<string, string>> = {
  'zh-CN': {
    'plan.routeName.template': '{city}{theme}{days}日游',
    'plan.routeName.rag': '{city}{suffix}{days}日游',
    'plan.routeName.ragDesc': '基于兜行景点库的{suffix}路线（{prompt}）',
    'plan.routeName.templateDesc': '{baseDesc}（根据「{prompt}」智能匹配）',
    'plan.routeName.defaultTheme': '精选',
    'plan.routeDay.date': '第{day}天',
    'plan.routeDay.title': '{city}{suffix}·第{day}天',
    'plan.routeName.ragMeta': '（内容库 RAG 组装）',
  },
  'en-US': {
    'plan.routeName.template': '{city} {theme} {days}-day trip',
    'plan.routeName.rag': '{city} {suffix} {days}-day trip',
    'plan.routeName.ragDesc': '{suffix} itinerary from Douxing POI library ({prompt})',
    'plan.routeName.templateDesc': '{baseDesc} (matched from "{prompt}")',
    'plan.routeName.defaultTheme': 'Curated',
    'plan.routeDay.date': 'Day {day}',
    'plan.routeDay.title': '{city} {suffix} · Day {day}',
    'plan.routeName.ragMeta': ' (POI library RAG)',
  },
};

function routeNameMsg(key: string, locale: LocaleCode, params?: Record<string, string | number>): string {
  const table = ROUTE_NAME_MESSAGES[locale] ?? ROUTE_NAME_MESSAGES[DEFAULT_LOCALE];
  const fallback = ROUTE_NAME_MESSAGES[DEFAULT_LOCALE];
  return formatMessage(table[key] ?? fallback[key] ?? key, params);
}

/** 模板匹配生成的路线标题 */
export function formatTemplateRouteName(params: {
  city: string | null;
  days: number;
  themeTag?: string | null;
  fallbackName: string;
  locale?: LocaleCode;
}): string {
  const locale = params.locale ?? DEFAULT_LOCALE;
  const city = params.city?.trim();
  if (!city) return params.fallbackName;
  const theme =
    params.themeTag != null && params.themeTag !== ''
      ? formatInterestTagLabel(params.themeTag, locale)
      : routeNameMsg('plan.routeName.defaultTheme', locale);
  return routeNameMsg('plan.routeName.template', locale, {
    city,
    theme,
    days: params.days,
  });
}

/** RAG 组装路线标题 */
export function formatRagRouteName(params: {
  city: string;
  days: number;
  variantKey?: string | null;
  locale?: LocaleCode;
}): string {
  const locale = params.locale ?? DEFAULT_LOCALE;
  const suffix = formatPlanVariantSuffix(params.variantKey, locale);
  return routeNameMsg('plan.routeName.rag', locale, {
    city: params.city,
    suffix,
    days: params.days,
  });
}

export function formatRagRouteDescription(params: {
  suffix?: string;
  variantKey?: string | null;
  promptSnippet: string;
  locale?: LocaleCode;
}): string {
  const locale = params.locale ?? DEFAULT_LOCALE;
  const suffix =
    params.suffix ?? formatPlanVariantSuffix(params.variantKey, locale);
  return routeNameMsg('plan.routeName.ragDesc', locale, {
    suffix,
    prompt: params.promptSnippet,
  });
}

export function formatTemplateRouteDescription(params: {
  baseDesc: string;
  promptSnippet: string;
  locale?: LocaleCode;
}): string {
  return routeNameMsg('plan.routeName.templateDesc', params.locale ?? DEFAULT_LOCALE, {
    baseDesc: params.baseDesc,
    prompt: params.promptSnippet,
  });
}

export function formatRouteDayDate(dayIndex: number, locale: LocaleCode = DEFAULT_LOCALE): string {
  return routeNameMsg('plan.routeDay.date', locale, { day: dayIndex + 1 });
}

export function formatRouteDayTitle(params: {
  city: string;
  variantKey?: string | null;
  dayIndex: number;
  locale?: LocaleCode;
}): string {
  const locale = params.locale ?? DEFAULT_LOCALE;
  const suffix = formatPlanVariantSuffix(params.variantKey, locale);
  return routeNameMsg('plan.routeDay.title', locale, {
    city: params.city,
    suffix,
    day: params.dayIndex + 1,
  });
}

export function formatRagRouteMetaSuffix(locale: LocaleCode = DEFAULT_LOCALE): string {
  return routeNameMsg('plan.routeName.ragMeta', locale);
}
