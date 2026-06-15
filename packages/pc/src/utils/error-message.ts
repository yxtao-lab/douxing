import {
  LOCALE_STORAGE_KEY,
  DEFAULT_LOCALE,
  isLocaleCode,
  resolveClientRequestErrorMessage,
  type LocaleCode,
} from '@douxing/shared';
import { getAiPlanCancelledMessage, isAiPlanCancelledError } from '@/api/ai-plan';

function getApiAcceptLanguage(): LocaleCode {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocaleCode(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export function getAppErrorMessage(err: unknown, fallback: string): string {
  if (isAiPlanCancelledError(err)) return getAiPlanCancelledMessage();
  if (!(err instanceof Error)) return fallback;
  return resolveClientRequestErrorMessage(err.message, getApiAcceptLanguage()) || fallback;
}
