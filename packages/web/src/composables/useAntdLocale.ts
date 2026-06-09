import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import enUS from 'ant-design-vue/es/locale/en_US';
import type { Locale } from 'ant-design-vue/es/locale';

const LOCALE_MAP: Record<string, Locale> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

/** 与 vue-i18n 同步的 Ant Design Vue 语言包 */
export function useAntdLocale() {
  const { locale } = useI18n();

  const antdLocale = computed(() => LOCALE_MAP[locale.value] ?? zhCN);

  return { antdLocale };
}
