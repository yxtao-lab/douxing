import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  type LocaleCode,
} from '@douxing/shared';
import { i18n } from './index';

export function useLocale() {
  const { locale, t } = useI18n();

  const currentLocale = computed(() => locale.value as LocaleCode);

  const localeOptions = SUPPORTED_LOCALES;

  function setLocale(code: LocaleCode) {
    if (locale.value === code) return;
    locale.value = code;
    i18n.global.locale.value = code;
    try {
      uni.setStorageSync(LOCALE_STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  }

  function showLocalePicker() {
    const labels = localeOptions.map((item) => item.label);
    uni.showActionSheet({
      itemList: labels,
      success: (res) => {
        const picked = localeOptions[res.tapIndex];
        if (picked) setLocale(picked.code);
      },
    });
  }

  return {
    t,
    currentLocale,
    localeOptions,
    setLocale,
    showLocalePicker,
  };
}
