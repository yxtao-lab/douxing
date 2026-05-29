import type { RouteScheduleSource } from '@douxing/shared';
import {
  getIntercityCacheTtlSec,
  INTERCITY_CACHE_KEY_PREFIX,
  isRedisEnabled,
} from '../config/redis.js';
import { getRedisClient } from './redis-client.service.js';

/** 可缓存的班次查询结果 */
export interface CachedIntercitySchedule {
  mode: 'train' | 'flight';
  scheduleNo: string;
  fromLabel: string;
  toLabel: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  cost: number;
  bookingUrl: string;
  source: RouteScheduleSource;
  estimated: boolean;
}

function normalizeCachePart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

export function buildIntercityCacheKey(
  fromCity: string,
  toCity: string,
  travelDate: string,
  preference: string,
  provider: string,
): string {
  return `${INTERCITY_CACHE_KEY_PREFIX}${normalizeCachePart(fromCity)}:${normalizeCachePart(toCity)}:${travelDate}:${preference}:${provider}`;
}

export async function getCachedIntercitySchedule(
  key: string,
): Promise<CachedIntercitySchedule | null> {
  if (!isRedisEnabled()) return null;

  try {
    const redis = await getRedisClient();
    if (!redis) return null;

    const raw = await redis.get(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedIntercitySchedule;
    if (
      typeof parsed.scheduleNo !== 'string' ||
      typeof parsed.durationMinutes !== 'number' ||
      typeof parsed.bookingUrl !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn(
      '[intercity-cache] 读取失败:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function setCachedIntercitySchedule(
  key: string,
  value: CachedIntercitySchedule,
): Promise<void> {
  if (!isRedisEnabled()) return;

  try {
    const redis = await getRedisClient();
    if (!redis) return;

    const ttl = getIntercityCacheTtlSec();
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    console.warn(
      '[intercity-cache] 写入失败:',
      err instanceof Error ? err.message : err,
    );
  }
}
