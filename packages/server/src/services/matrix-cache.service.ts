import {
  getMatrixCacheTtlSec,
  isRedisEnabled,
  MATRIX_CACHE_KEY_PREFIX,
} from '../config/redis.js';
import type { TravelDurationResult } from './amap-direction.service.js';
import { getRedisClient } from './redis-client.service.js';

function roundCoord(value: number): string {
  return value.toFixed(5);
}

/** 缓存键：douxing:amap:matrix:{lat1,lng1}:{lat2,lng2} */
export function buildMatrixCacheKey(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): string {
  const a = `${roundCoord(fromLat)},${roundCoord(fromLng)}`;
  const b = `${roundCoord(toLat)},${roundCoord(toLng)}`;
  const [first, second] = [a, b].sort();
  return `${MATRIX_CACHE_KEY_PREFIX}${first}:${second}`;
}

export async function getCachedTravelDuration(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<TravelDurationResult | null> {
  if (!isRedisEnabled()) return null;

  try {
    const redis = await getRedisClient();
    if (!redis) return null;

    const raw = await redis.get(buildMatrixCacheKey(fromLat, fromLng, toLat, toLng));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as TravelDurationResult;
    if (
      typeof parsed.durationMinutes !== 'number' ||
      typeof parsed.distanceMeters !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn(
      '[matrix-cache] 读取失败:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function setCachedTravelDuration(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  result: TravelDurationResult,
): Promise<void> {
  if (!isRedisEnabled()) return;

  try {
    const redis = await getRedisClient();
    if (!redis) return;

    const ttl = getMatrixCacheTtlSec();
    await redis.set(
      buildMatrixCacheKey(fromLat, fromLng, toLat, toLng),
      JSON.stringify(result),
      'EX',
      ttl,
    );
  } catch (err) {
    console.warn(
      '[matrix-cache] 写入失败:',
      err instanceof Error ? err.message : err,
    );
  }
}
