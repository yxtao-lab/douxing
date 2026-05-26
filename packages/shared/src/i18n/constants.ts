import type { LocaleCode, LocaleOption } from './types.js';

export const DEFAULT_LOCALE: LocaleCode = 'zh-CN';

export const LOCALE_STORAGE_KEY = 'douxing_locale';

export const SUPPORTED_LOCALES: readonly LocaleOption[] = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English' },
] as const;
