import type { TravelIntentSnapshot } from '../types.js';
import type { LocaleCode } from './types.js';
import { DEFAULT_LOCALE } from './constants.js';
import { formatMessage } from './format-message.js';
import { formatInterestTagLabel } from './interest-tags.js';
import { formatPlanVariantLabel } from './plan-variants.js';

const PLAN_MESSAGES: Record<LocaleCode, Record<string, string>> = {
  'zh-CN': {
    'plan.intent.days': '{days}天',
    'plan.intent.budget': '预算{budget}',
    'plan.intent.default': '通用休闲游',
    'plan.intent.prefix': '已理解需求：{summary}',
    'plan.intent.prefixLine': '\n已理解需求：{summary}',
    'plan.assistant.multiCandidate':
      '已为您生成 {count} 套候选方案，请在下方选择。当前默认选中「{selectedName}」。{intentHint}',
    'plan.assistant.single':
      '已为您生成「{name}」：{description}（{days} 天{budgetSuffix}）{intentHint}{ragHint}',
    'plan.assistant.budgetSuffix': '，预算 {budget}',
    'plan.assistant.ragHint': '\n已引用内容库景点 {count} 处',
    'plan.assistant.switched': '已切换为「{label}」：{name}',
  },
  'en-US': {
    'plan.intent.days': '{days} days',
    'plan.intent.budget': 'Budget {budget}',
    'plan.intent.default': 'General leisure trip',
    'plan.intent.prefix': 'Understood: {summary}',
    'plan.intent.prefixLine': '\nUnderstood: {summary}',
    'plan.assistant.multiCandidate':
      'Generated {count} plan drafts. Pick one below. Default: 「{selectedName}」.{intentHint}',
    'plan.assistant.single':
      'Generated 「{name}」: {description} ({days} days{budgetSuffix}){intentHint}{ragHint}',
    'plan.assistant.budgetSuffix': ', budget {budget}',
    'plan.assistant.ragHint': '\nMatched {count} POIs from library',
    'plan.assistant.switched': 'Switched to 「{label}」: {name}',
  },
};

function planMsg(key: string, locale: LocaleCode, params?: Record<string, string | number>): string {
  const table = PLAN_MESSAGES[locale] ?? PLAN_MESSAGES[DEFAULT_LOCALE];
  const fallback = PLAN_MESSAGES[DEFAULT_LOCALE];
  return formatMessage(table[key] ?? fallback[key] ?? key, params);
}

/** 规划意图摘要（助手消息与前端 intent 条复用） */
export function formatPlanIntentSummary(
  intent: TravelIntentSnapshot,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  if (intent.constraintSummary?.trim()) {
    return intent.constraintSummary.trim();
  }
  const parts: string[] = [];
  if (intent.departureCity) {
    parts.push(
      locale === 'en-US'
        ? `From ${intent.departureCity}`
        : `从${intent.departureCity}出发`,
    );
  }
  const planningCity =
    intent.city && intent.departureCity && intent.city === intent.departureCity
      ? intent.suggestedDestinations?.find((item) => item !== intent.departureCity) ?? null
      : intent.city ?? intent.suggestedDestinations?.[0] ?? null;
  if (planningCity) parts.push(planningCity);
  if (intent.days != null) {
    parts.push(planMsg('plan.intent.days', locale, { days: intent.days }));
  }
  if (intent.budget) {
    parts.push(planMsg('plan.intent.budget', locale, { budget: intent.budget }));
  }
  if (intent.themes.length > 0) {
    const sep = locale === 'en-US' ? ', ' : '·';
    parts.push(
      intent.themes.map((theme) => formatInterestTagLabel(theme, locale)).join(sep),
    );
  }
  if (intent.excludeProvinceCodes?.length) {
    parts.push(
      locale === 'en-US'
        ? `Exclude ${intent.excludeProvinceCodes.join(', ')}`
        : `不出${intent.excludeProvinceCodes.join('、')}`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : planMsg('plan.intent.default', locale);
}

function buildIntentHintLine(intent: TravelIntentSnapshot | undefined, locale: LocaleCode): string {
  if (!intent) return '';
  const summary = formatPlanIntentSummary(intent, locale);
  return planMsg('plan.intent.prefixLine', locale, { summary });
}

/** 多套候选方案助手回复 */
export function buildMultiCandidateAssistantReply(
  count: number,
  selectedName: string,
  intent: TravelIntentSnapshot | undefined,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  return planMsg('plan.assistant.multiCandidate', locale, {
    count,
    selectedName,
    intentHint: buildIntentHintLine(intent, locale),
  });
}

/** 单套方案助手回复 */
export function buildPlanAssistantReply(
  route: {
    name: string;
    description: string | null;
    days: number;
    budgetRange: string | null;
    routeDetail?: Record<string, unknown> | null;
  },
  intent: TravelIntentSnapshot | undefined,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  const budgetSuffix = route.budgetRange
    ? planMsg('plan.assistant.budgetSuffix', locale, { budget: route.budgetRange })
    : '';
  const detail = route.routeDetail ?? {};
  const ragMatched = typeof detail.ragMatchedCount === 'number' ? detail.ragMatchedCount : 0;
  const ragHint =
    ragMatched > 0 ? planMsg('plan.assistant.ragHint', locale, { count: ragMatched }) : '';

  return planMsg('plan.assistant.single', locale, {
    name: route.name,
    description: route.description ?? '',
    days: route.days,
    budgetSuffix,
    intentHint: buildIntentHintLine(intent, locale),
    ragHint,
  });
}

/** 切换候选方案助手回复 */
export function buildPlanCandidateSwitchedReply(
  variantKey: string | null | undefined,
  routeName: string,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  const label = formatPlanVariantLabel(variantKey, locale);
  return planMsg('plan.assistant.switched', locale, { label, name: routeName });
}
