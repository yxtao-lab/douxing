import { watch } from 'vue';
import { useI18n } from 'vue-i18n';

/** 按当前语言设置浏览器标签页标题 */
export function usePageTitle(messageKey: string) {
  const { t, locale } = useI18n();

  function applyTitle() {
    document.title = `${t(messageKey)} · ${t('app.name')}`;
  }

  watch(locale, applyTitle, { immediate: true });

  return { t, locale };
}
