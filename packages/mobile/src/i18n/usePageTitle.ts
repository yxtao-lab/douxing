import { watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';

/** 按当前语言设置导航栏标题（pages.json 中的标题仅作构建占位） */
export function usePageTitle(messageKey: string) {
  const { t, locale } = useI18n();

  function applyTitle() {
    uni.setNavigationBarTitle({ title: t(messageKey) });
  }

  onShow(applyTitle);
  watch(locale, applyTitle);

  return { t, locale };
}
