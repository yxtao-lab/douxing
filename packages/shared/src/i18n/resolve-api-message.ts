import type { LocaleCode } from './types.js';
import { DEFAULT_LOCALE } from './constants.js';
import { API_MESSAGES } from './api-messages.js';
import { formatMessage } from './format-message.js';
import { isApiMessageKey, type ApiMessageKeyType } from './api-keys.js';

export type ApiMessageParams = Record<string, string | number | null | undefined>;

export function resolveApiMessage(
  key: ApiMessageKeyType | string,
  locale: LocaleCode = DEFAULT_LOCALE,
  params?: ApiMessageParams,
): string {
  const table = API_MESSAGES[locale] ?? API_MESSAGES[DEFAULT_LOCALE];
  const fallback = API_MESSAGES[DEFAULT_LOCALE];
  const template = table[key] ?? fallback[key] ?? key;
  return formatMessage(template, params);
}

export function resolveApiMessageInput(
  messageOrKey: string,
  locale: LocaleCode,
  params?: ApiMessageParams,
  legacyMap?: Record<string, ApiMessageKeyType>,
): { message: string; messageKey?: ApiMessageKeyType } {
  if (isApiMessageKey(messageOrKey)) {
    return {
      messageKey: messageOrKey,
      message: resolveApiMessage(messageOrKey, locale, params),
    };
  }

  const mappedKey = legacyMap?.[messageOrKey];
  if (mappedKey) {
    return {
      messageKey: mappedKey,
      message: resolveApiMessage(mappedKey, locale, params),
    };
  }

  const smsRateMatch = /^请 (\d+) 秒后再试$/.exec(messageOrKey);
  if (smsRateMatch) {
    const seconds = Number(smsRateMatch[1]);
    return {
      messageKey: 'api.smsRateLimit' as ApiMessageKeyType,
      message: resolveApiMessage('api.smsRateLimit', locale, { seconds }),
    };
  }

  return { message: messageOrKey };
}
