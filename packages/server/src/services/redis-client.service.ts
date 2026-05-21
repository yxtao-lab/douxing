import { Redis, type Redis as RedisClient } from 'ioredis';
import { getRedisUrl, isRedisEnabled } from '../config/redis.js';

let client: RedisClient | null = null;
let disabled = false;

/** 获取 Redis 客户端；不可用时返回 null（不抛错，便于降级） */
export async function getRedisClient(): Promise<RedisClient | null> {
  if (disabled || !isRedisEnabled()) return null;
  if (client) return client;

  const url = getRedisUrl();
  if (!url) return null;

  try {
    const redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    await redis.connect();
    redis.on('error', (err: Error) => {
      console.warn('[redis] 连接异常:', err.message);
    });
    client = redis;
    console.log('[redis] 已连接，地理编码缓存可用');
    return client;
  } catch (err) {
    disabled = true;
    console.warn(
      '[redis] 连接失败，地理编码缓存已禁用:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function closeRedisClient(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
