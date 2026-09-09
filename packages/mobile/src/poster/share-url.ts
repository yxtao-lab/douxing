/**
 * 构建路线 H5 只读分享链接（海报二维码的末级兜底，优先仍用小程序码）。
 *
 * @param routeId - 路线 ID
 * @returns 完整 H5 hash 链接；未配置 `VITE_H5_BASE_URL` 时返回 `null`
 */
export function buildRouteShareUrl(routeId: number): string | null {
  const base = import.meta.env.VITE_H5_BASE_URL?.trim().replace(/\/$/, '');
  if (!base) return null;
  return `${base}/#/pages/share/route?id=${routeId}`;
}
