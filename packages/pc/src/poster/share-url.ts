const POSTER_OPTIONS_STORAGE_KEY = 'douxing_pc_poster_options';

/** D5-a：构建 PC 只读分享链接（用于海报二维码） */
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
