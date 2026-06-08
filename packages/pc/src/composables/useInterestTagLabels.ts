import { computed } from 'vue';
import { joinInterestTagLabels, type LocaleCode } from '@douxing/shared';
import { useLocale } from '@/i18n/useLocale';

/** PC 端兴趣标签展示（随 locale 响应式更新） */
export function useInterestTagLabels() {
  const { currentLocale } = useLocale();

  const joinLabels = computed(
    () => (tags: string[] | null | undefined) =>
      joinInterestTagLabels(tags, currentLocale.value as LocaleCode),
  );

  return { joinLabels };
}
