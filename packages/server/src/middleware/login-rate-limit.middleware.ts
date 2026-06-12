import type { Request, Response, NextFunction } from 'express';
import { API_PREFIX, ApiMessageKey } from '@douxing/shared';
import { fail } from '../utils/response.js';
import { getRedisClient } from '../services/redis-client.service.js';

const LOGIN_PATH = `${API_PREFIX}/auth/login`;
const WINDOW_SEC = 15 * 60;
const MAX_FAILS_PER_IP = 20;
const MAX_FAILS_PER_USER = 10;

type MemoryBucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, MemoryBucket>();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

async function readCounter(key: string, windowSec: number): Promise<number> {
  const redis = await getRedisClient();
  if (redis) {
    const value = await redis.get(key);
    return value ? Number(value) : 0;
  }

  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= Date.now()) {
    return 0;
  }
  return bucket.count;
}

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

async function isLoginBlocked(req: Request, username: string): Promise<boolean> {
  const ip = getClientIp(req);
  const ipKey = `login:fail:ip:${ip}`;
  const userKey = `login:fail:user:${username.toLowerCase()}`;

  const [ipCount, userCount] = await Promise.all([
    readCounter(ipKey, WINDOW_SEC),
    readCounter(userKey, WINDOW_SEC),
  ]);

  return ipCount >= MAX_FAILS_PER_IP || userCount >= MAX_FAILS_PER_USER;
}

/** 登录失败时累加计数（由 auth 路由调用） */
export async function recordFailedLoginAttempt(req: Request, username: string): Promise<void> {
  const ip = getClientIp(req);
  await Promise.all([
    incrementCounter(`login:fail:ip:${ip}`, WINDOW_SEC),
    incrementCounter(`login:fail:user:${username.toLowerCase()}`, WINDOW_SEC),
  ]);
}

/** 登录前检查是否已被限流 */
export async function loginRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.method !== 'POST' || req.path !== LOGIN_PATH) {
    next();
    return;
  }

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  if (!username) {
    next();
    return;
  }

  try {
    if (await isLoginBlocked(req, username)) {
      fail(res, ApiMessageKey.LOGIN_RATE_LIMITED, 429, 429);
      return;
    }
  } catch (err) {
    console.error('[login-rate-limit]', err);
  }

  next();
}
