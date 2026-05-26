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
    'zh-CN': { ...sharedZhCN, ...webZhCN },
    'en-US': { ...sharedEnUS, ...webEnUS },
  },
});

export function persistLocale(code: LocaleCode) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}
