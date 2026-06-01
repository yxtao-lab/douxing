import type { AppThemeId } from '@/i18n/useTheme';
import { THEME_STORAGE_KEY } from '@/i18n/useTheme';

/** 与 theme.css 中 page / .theme-teal 的 --dx-primary 默认值对齐 */
export const DX_PRIMARY_HEX: Record<AppThemeId, string> = {
  blue: '#1677ff',
  teal: '#13c2c2',
};

export function readAppThemeId(): AppThemeId {
  try {
    const stored = uni.getStorageSync(THEME_STORAGE_KEY);
    if (stored === 'teal') return 'teal';
  } catch {
    /* ignore */
  }
  return 'blue';
}

/** 运行时主色（原生 switch、map polyline 等须 hex 字符串） */
export function getDxPrimaryColor(themeId?: AppThemeId): string {
  return DX_PRIMARY_HEX[themeId ?? readAppThemeId()];
}

/** 微信 map polyline 支持 #RRGGBBAA */
export function getDxPrimaryColorAlpha(alphaHex = 'AA', themeId?: AppThemeId): string {
  const base = getDxPrimaryColor(themeId).replace('#', '');
  const aa = alphaHex.replace('#', '').padStart(2, '0').slice(-2);
  return `#${base}${aa}`;
}
