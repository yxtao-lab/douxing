import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocaleCode, type LocaleCode } from '@douxing/shared';

/** 读取当前界面语言，用于 API Accept-Language */
export function getApiAcceptLanguage(): LocaleCode {
  try {
    const stored = uni.getStorageSync(LOCALE_STORAGE_KEY) as string;
    if (isLocaleCode(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}
