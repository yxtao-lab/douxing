import {
  getPolylineCacheTtlSec,
  isRedisEnabled,
  POLYLINE_CACHE_KEY_PREFIX,
} from '../config/redis.js';
import type { DirectionPolylineResult } from './amap-direction.service.js';
import { getRedisClient } from './redis-client.service.js';

function roundCoord(value: number): string {
  return value.toFixed(5);
}

export function buildPolylineCacheKey(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  mode: 'walk' | 'drive',
): string {
  const a = `${roundCoord(fromLat)},${roundCoord(fromLng)}`;
  const b = `${roundCoord(toLat)},${roundCoord(toLng)}`;
  const [first, second] = [a, b].sort();
  return `${POLYLINE_CACHE_KEY_PREFIX}${mode}:${first}:${second}`;
}

export async function getCachedDirectionPolyline(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  mode: 'walk' | 'drive',
): Promise<DirectionPolylineResult | null> {
  if (!isRedisEnabled()) return null;

  try {
    const redis = await getRedisClient();
    if (!redis) return null;

    const raw = await redis.get(buildPolylineCacheKey(fromLat, fromLng, toLat, toLng, mode));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DirectionPolylineResult;
    if (!Array.isArray(parsed.points) || parsed.points.length < 2) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn(
      '[polyline-cache] 读取失败:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function setCachedDirectionPolyline(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  mode: 'walk' | 'drive',
  result: DirectionPolylineResult,
): Promise<void> {
  if (!isRedisEnabled()) return;

  try {
    const redis = await getRedisClient();
    if (!redis) return;

    const ttl = getPolylineCacheTtlSec();
    await redis.set(
      buildPolylineCacheKey(fromLat, fromLng, toLat, toLng, mode),
      JSON.stringify(result),
      'EX',
      ttl,
    );
  } catch (err) {
    console.warn(
      '[polyline-cache] 写入失败:',
      err instanceof Error ? err.message : err,
    );
  }
}
