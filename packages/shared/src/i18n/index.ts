export type { LocaleCode, LocaleOption } from './types.js';
export { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, SUPPORTED_LOCALES } from './constants.js';
export { sharedZhCN } from './locales/zh-CN.js';
export { sharedEnUS } from './locales/en-US.js';
export { formatMessage } from './format-message.js';
export { ApiMessageKey, isApiMessageKey } from './api-keys.js';
export type { ApiMessageKeyType } from './api-keys.js';
export { API_MESSAGES } from './api-messages.js';
export { API_LEGACY_MESSAGE_MAP } from './api-legacy-map.js';
export {
  resolveApiMessage,
  resolveApiMessageInput,
  type ApiMessageParams,
} from './resolve-api-message.js';
export { getLocaleFromAcceptLanguage } from './request-locale.js';
export { ApiError, isApiError } from './api-error.js';
export {
  isSystemRequestErrorMessage,
  resolveClientRequestErrorMessage,
} from './client-request-error.js';
export {
  formatInterestTagLabel,
  joinInterestTagLabels,
  getInterestTagSlug,
  interestTagPresets,
  type InterestTagValue,
  type InterestTagSlug,
} from './interest-tags.js';
export {
  formatPlanIntentSummary,
  buildMultiCandidateAssistantReply,
  buildPlanAssistantReply,
  buildPlanCandidateSwitchedReply,
  buildFoodQaAssistantReply,
  buildBudgetTunedAssistantHint,
  buildLodgingTunedAssistantHint,
} from './plan-messages.js';
export {
  formatPlanVariantLabel,
  formatPlanVariantHint,
  formatPlanVariantSuffix,
} from './plan-variants.js';
export {
  formatTemplateRouteName,
  formatRagRouteName,
  formatRagRouteDescription,
  formatTemplateRouteDescription,
  formatRouteDayDate,
  formatRouteDayTitle,
  formatRagRouteMetaSuffix,
} from './plan-route-names.js';
export {
  formatEnricherWarning,
  formatIntercitySegmentDescription,
  formatPlaybookTransitDescription,
  type EnricherWarningKey,
  type IntercityDescriptionKey,
} from './enricher-messages.js';
export {
  formatValidatorWarning,
  type ValidatorWarningKey,
} from './validator-messages.js';
export type { PlaybookTransitReasonKey } from '../types.js';

import { MemberLevel } from '../constants.js';
import type { LocaleCode } from './types.js';

const MEMBER_LEVEL_I18N_KEY: Record<number, string> = {
  [MemberLevel.FREE]: 'memberLevel.free',
  [MemberLevel.SILVER]: 'memberLevel.silver',
  [MemberLevel.GOLD]: 'memberLevel.gold',
  [MemberLevel.VIP]: 'memberLevel.vip',
};

/** 根据会员等级返回 i18n 键（在组件内配合 `t()` 使用） */
export function getMemberLevelI18nKey(level: number | null | undefined): string {
  const normalized = level == null || !Number.isFinite(level) ? MemberLevel.FREE : Math.trunc(level);
  return MEMBER_LEVEL_I18N_KEY[normalized] ?? MEMBER_LEVEL_I18N_KEY[MemberLevel.FREE];
}

/** 将系统/浏览器语言标签规范为支持的 LocaleCode */
export function normalizeLocaleTag(tag: string | undefined | null): LocaleCode {
  if (!tag) return 'zh-CN';
  const lower = tag.toLowerCase().replace('_', '-');
  if (lower.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

export function isLocaleCode(value: string): value is LocaleCode {
  return value === 'zh-CN' || value === 'en-US';
}
