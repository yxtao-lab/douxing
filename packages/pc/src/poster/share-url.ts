const POSTER_OPTIONS_STORAGE_KEY = 'douxing_pc_poster_options';

/**
 * 构建 PC Web 路线只读分享链接（海报二维码末级兜底，优先仍用小程序码）。
 *
 * @param routeId - 路线 ID
 * @returns `/share/routes/{id}` 绝对 URL；无法解析基址时返回 `null`
 */
export function buildRouteShareUrl(routeId: number): string | null {
  const envBase = import.meta.env.VITE_PC_BASE_URL?.trim().replace(/\/$/, '');
  if (envBase) {
    return `${envBase}/share/routes/${routeId}`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/share/routes/${routeId}`;
  }
  return null;
}

export { POSTER_OPTIONS_STORAGE_KEY };
