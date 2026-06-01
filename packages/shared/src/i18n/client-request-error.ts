import type { LocaleCode } from './types.js';
import { DEFAULT_LOCALE } from './constants.js';
import { ApiMessageKey } from './api-keys.js';
import { resolveApiMessage } from './resolve-api-message.js';

const SYSTEM_ERROR_PATTERNS: RegExp[] = [
  /^request:fail\b/i,
  /^uploadfile:fail\b/i,
  /^downloadfile:fail\b/i,
  /^network error$/i,
  /^timeout$/i,
  /^error:\s*timeout$/i,
  /^failed to fetch$/i,
  /\berr_network\b/i,
  /\beconnrefused\b/i,
  /\beconnreset\b/i,
  /\betimedout\b/i,
  /\benotfound\b/i,
  /socket hang up/i,
  /timeout.*exceeded/i,
  /^connect E/i,
  /^getaddrinfo ENOTFOUND/i,
];

const TIMEOUT_PATTERNS: RegExp[] = [
  /timeout/i,
  /\betimedout\b/i,
  /超时/,
];

/** 是否为客户端/网络层系统错误（不应直接展示给用户） */
export function isSystemRequestErrorMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return true;
  const lower = text.toLowerCase();
  return SYSTEM_ERROR_PATTERNS.some((pattern) => pattern.test(text) || pattern.test(lower));
}

function isTimeoutErrorMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  return TIMEOUT_PATTERNS.some((pattern) => pattern.test(text) || pattern.test(lower));
}

/** 将 uni.request / axios 等原始错误转为用户可读文案 */
export function resolveClientRequestErrorMessage(
  raw: string | undefined | null,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  const text = raw?.trim() ?? '';
  const isTimeout = isTimeoutErrorMessage(text);
  if (!text || isSystemRequestErrorMessage(text) || isTimeout) {
    const key = isTimeout ? ApiMessageKey.REQUEST_TIMEOUT : ApiMessageKey.NETWORK_ERROR;
    return resolveApiMessage(key, locale);
  }
  return text;
}
