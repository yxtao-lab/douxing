import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  formatInterestTagLabel,
  joinInterestTagLabels,
  type LocaleCode,
} from '@douxing/shared';

/** 兴趣标签展示（随 locale 响应式更新） */
export function useInterestTagLabel() {
  const { locale } = useI18n();

  const currentLocale = computed(() => locale.value as LocaleCode);

  const labelOf = computed(
    () => (tag: string) => formatInterestTagLabel(tag, currentLocale.value),
  );

  const joinLabels = computed(
    () => (tags: string[] | null | undefined) => joinInterestTagLabels(tags, currentLocale.value),
  );

  return { labelOf, joinLabels, currentLocale };
}
