import { ApiError, ApiMessageKey } from '@douxing/shared';
import { getRedisClient } from './redis-client.service.js';

type MemoryBucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, MemoryBucket>();

/**
 * 读取频控计数。
 *
 * @param key - 计数键
 * @param windowSec - 窗口秒数
 * @returns 当前计数
 */
async function readCounter(key: string, windowSec: number): Promise<number> {
  const redis = await getRedisClient();
  if (redis) {
    const value = await redis.get(key);
    return value ? Number(value) : 0;
  }
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= Date.now()) return 0;
  return bucket.count;
}

/**
 * 自增频控计数。
 *
 * @param key - 计数键
 * @param windowSec - 窗口秒数
 * @returns 自增后计数
 */
async function incrementCounter(key: string, windowSec: number): Promise<number> {
  const redis = await getRedisClient();
  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSec);
    }
    return count;
  }
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return 1;
  }
  bucket.count += 1;
  return bucket.count;
}

/**
 * U5：断言用户动作未超频；超限抛 ApiError。
 * 先读后增：已达上限则不消耗配额。
 *
 * @param userId - 用户 ID
 * @param action - 动作标识 like | comment | report | checkin
 * @param limit - 窗口内上限
 * @param windowSec - 窗口秒数
 * @throws {ApiError} 超限时 UGC_RATE_LIMITED
 */
export async function assertUgcRateLimit(
  userId: number,
  action: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const key = `ugc:rl:${action}:${userId}`;
  const current = await readCounter(key, windowSec);
  if (current >= limit) {
    throw new ApiError(ApiMessageKey.UGC_RATE_LIMITED, { action, limit });
  }
  await incrementCounter(key, windowSec);
}

/**
 * 测试用：清空内存频控桶（不清理 Redis）。
 */
export function clearUgcRateLimitMemoryForTests(): void {
  memoryBuckets.clear();
}
