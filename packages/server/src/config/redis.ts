/** Redis 配置（地理编码缓存等，密钥仅从环境变量读取） */

function trimEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

export function getRedisUrl(): string | null {
  const url = trimEnv('REDIS_URL');
  return url || null;
}

/** 未显式关闭且配置了 REDIS_URL 时启用 */
export function isRedisEnabled(): boolean {
  if (trimEnv('REDIS_ENABLED') === 'false') return false;
  return !!getRedisUrl();
}

/** 高德 geocode 缓存 TTL（秒），默认 30 天 */
export function getGeocodeCacheTtlSec(): number {
  const raw = parseInt(trimEnv('AMAP_GEOCODE_CACHE_TTL_SEC') || '2592000', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 2592000;
}

export const GEOCODE_CACHE_KEY_PREFIX = 'douxing:amap:geocode:';

/** 高德 distance/matrix 缓存键前缀 */
export const MATRIX_CACHE_KEY_PREFIX = 'douxing:amap:matrix:';

/** 路网耗时缓存 TTL（秒），默认 7 天 */
export function getMatrixCacheTtlSec(): number {
  const raw = parseInt(trimEnv('AMAP_MATRIX_CACHE_TTL_SEC') || '604800', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 604800;
}

/** 高德 direction polyline 缓存键前缀 */
export const POLYLINE_CACHE_KEY_PREFIX = 'douxing:amap:polyline:';

/** polyline 缓存 TTL（秒），默认 7 天 */
export function getPolylineCacheTtlSec(): number {
  const raw = parseInt(trimEnv('AMAP_POLYLINE_CACHE_TTL_SEC') || '604800', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 604800;
}
