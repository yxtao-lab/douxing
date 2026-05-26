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
import { mobileEnUS } from './locales/en-US';
import { mobileZhCN } from './locales/zh-CN';

function readStoredLocale(): LocaleCode | null {
  try {
    const stored = uni.getStorageSync(LOCALE_STORAGE_KEY) as string;
    if (isLocaleCode(stored)) return stored;
  } catch {
    /* 非 uni 环境（如部分测试） */
  }
  return null;
}

function detectSystemLocale(): LocaleCode {
  try {
    const info = uni.getSystemInfoSync();
    return normalizeLocaleTag(info.language);
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function resolveInitialLocale(): LocaleCode {
  return readStoredLocale() ?? detectSystemLocale();
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: resolveInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    'zh-CN': { ...sharedZhCN, ...mobileZhCN },
    'en-US': { ...sharedEnUS, ...mobileEnUS },
  },
});
