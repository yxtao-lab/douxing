import { useI18n } from 'vue-i18n';
import { formatMessage } from '@douxing/shared';

type MessageParams = Record<string, string | number | null | undefined>;

/**
 * 带插值的翻译：先取文案模板，再替换 `{key}`。
 * UniApp 部分端上 vue-i18n 内置编译器可能不生效，需此兜底。
 */
export function useTf() {
  const { t, locale } = useI18n();

  function tf(key: string, params?: MessageParams): string {
    return formatMessage(String(t(key)), params);
  }

  return { t, tf, locale };
}
