import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { SUPPORTED_LOCALES, type LocaleCode } from '@douxing/shared';
import { i18n, persistLocale } from './index';

export function useLocale() {
  const { locale, t } = useI18n();

  const currentLocale = computed(() => locale.value as LocaleCode);
  const localeOptions = SUPPORTED_LOCALES;

  function setLocale(code: LocaleCode) {
    if (locale.value === code) return;
    locale.value = code;
    i18n.global.locale.value = code;
    persistLocale(code);
  }

  return { t, currentLocale, localeOptions, setLocale };
}
