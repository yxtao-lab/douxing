import {
  GEOCODE_CACHE_KEY_PREFIX,
  getGeocodeCacheTtlSec,
  isRedisEnabled,
} from '../config/redis.js';
import type { GeocodeResult } from './amap-geocode.service.js';
import { getRedisClient } from './redis-client.service.js';

function normalizeCachePart(value: string): string {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

/** 缓存键：douxing:amap:geocode:{city}:{name} */
export function buildGeocodeCacheKey(city: string, name: string): string {
  return `${GEOCODE_CACHE_KEY_PREFIX}${normalizeCachePart(city)}:${normalizeCachePart(name)}`;
}

export async function getCachedGeocode(
  city: string,
  name: string,
): Promise<GeocodeResult | null> {
  if (!isRedisEnabled()) return null;

  try {
    const redis = await getRedisClient();
    if (!redis) return null;

    const raw = await redis.get(buildGeocodeCacheKey(city, name));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as GeocodeResult;
    if (
      typeof parsed.latitude !== 'number' ||
      typeof parsed.longitude !== 'number' ||
      !parsed.method
    ) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn(
      '[geocode-cache] 读取失败:',
      city,
      name,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function setCachedGeocode(
  city: string,
  name: string,
  result: GeocodeResult,
): Promise<void> {
  if (!isRedisEnabled()) return;

  try {
    const redis = await getRedisClient();
    if (!redis) return;

    const ttl = getGeocodeCacheTtlSec();
    await redis.set(
      buildGeocodeCacheKey(city, name),
      JSON.stringify(result),
      'EX',
      ttl,
    );
  } catch (err) {
    console.warn(
      '[geocode-cache] 写入失败:',
      city,
      name,
      err instanceof Error ? err.message : err,
    );
  }
}
