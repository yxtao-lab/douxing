import { formatMessage } from '@douxing/shared';
import { i18n } from './index';

/** 非 Vue 模块内取当前界面语言文案（与 useTf 插值规则一致） */
export function mobileT(
  key: string,
  params?: Record<string, string | number | null | undefined>,
): string {
  const raw = String(i18n.global.t(key));
  return params ? formatMessage(raw, params) : raw;
}

export function currentMobileLocale(): string {
  const locale = i18n.global.locale;
  return typeof locale === 'string' ? locale : String(locale.value);
}
