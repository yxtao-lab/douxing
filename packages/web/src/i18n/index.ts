import { createI18n } from 'vue-i18n';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  sharedEnUS,
  sharedZhCN,
  isLocaleCode,
  normalizeLocaleTag,
  type LocaleCode,
} from '@douxing/shared';
import { webEnUS } from './locales/en-US';
import { webZhCN } from './locales/zh-CN';

/**
 * 深度合并 locale 消息：web 端覆盖 shared 同名字段，保留 shared 中未在 web 定义的键。
 *
 * @param base - shared 基础文案
 * @param override - web 端覆盖文案
 * @returns 合并后的完整 locale 对象
 */
function deepMergeLocaleMessages<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const result = { ...base } as Record<string, unknown>;
  for (const [key, overrideVal] of Object.entries(override)) {
    const baseVal = base[key];
    if (
      overrideVal &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      baseVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMergeLocaleMessages(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      );
    } else {
      result[key] = overrideVal;
    }
  }
  return result as T;
}

function readStoredLocale(): LocaleCode | null {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocaleCode(stored)) return stored;
  } catch {
    /* ignore */
  }
  return null;
}

function detectBrowserLocale(): LocaleCode {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  return normalizeLocaleTag(navigator.language);
}

export function resolveInitialLocale(): LocaleCode {
  return readStoredLocale() ?? detectBrowserLocale();
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: resolveInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    'zh-CN': deepMergeLocaleMessages(sharedZhCN, webZhCN),
    'en-US': deepMergeLocaleMessages(sharedEnUS, webEnUS),
  },
});

export function persistLocale(code: LocaleCode) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}
