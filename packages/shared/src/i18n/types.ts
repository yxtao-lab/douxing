/** 当前支持的界面语言 */
export type LocaleCode = 'zh-CN' | 'en-US';

export interface LocaleOption {
  code: LocaleCode;
  /** 用该语言书写的人类可读名称 */
  label: string;
}
