/** D5-a：构建 H5 只读分享链接（用于海报二维码） */
export function buildRouteShareUrl(routeId: number): string | null {
  const base = import.meta.env.VITE_H5_BASE_URL?.trim().replace(/\/$/, '');
  if (!base) return null;
  return `${base}/#/pages/share/route?id=${routeId}`;
}
