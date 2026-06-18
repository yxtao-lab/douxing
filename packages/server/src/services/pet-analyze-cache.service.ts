import { isRedisEnabled } from '../config/redis.js';
import type { PetAnalyzeResult, PetAnalyzeScene } from '@douxing/shared';
import { getRedisClient } from './redis-client.service.js';

const PET_ANALYZE_CACHE_PREFIX = 'douxing:pet:analyze:';
const DEFAULT_TTL_SEC = 900;

function buildCacheKey(userId: number, scene: PetAnalyzeScene, routeId?: number): string {
  const routePart = routeId ? `:route:${routeId}` : '';
  return `${PET_ANALYZE_CACHE_PREFIX}${userId}:${scene}${routePart}`;
}

export async function getCachedPetAnalyze(
  userId: number,
  scene: PetAnalyzeScene,
  routeId?: number,
): Promise<PetAnalyzeResult | null> {
  if (!isRedisEnabled()) return null;
  try {
    const redis = await getRedisClient();
    if (!redis) return null;
    const raw = await redis.get(buildCacheKey(userId, scene, routeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PetAnalyzeResult;
    if (!parsed?.insight || !parsed?.petReply) return null;
    return { ...parsed, cached: true };
  } catch (err) {
    console.warn('[pet-analyze-cache] 读取失败:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setCachedPetAnalyze(
  userId: number,
  scene: PetAnalyzeScene,
  result: PetAnalyzeResult,
  routeId?: number,
  ttlSec = DEFAULT_TTL_SEC,
): Promise<void> {
  if (!isRedisEnabled()) return;
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.set(buildCacheKey(userId, scene, routeId), JSON.stringify(result), 'EX', ttlSec);
  } catch (err) {
    console.warn('[pet-analyze-cache] 写入失败:', err instanceof Error ? err.message : err);
  }
}

export async function clearCachedPetAnalyze(
  userId: number,
  scene: PetAnalyzeScene,
  routeId?: number,
): Promise<void> {
  if (!isRedisEnabled()) return;
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.del(buildCacheKey(userId, scene, routeId));
  } catch {
    /* ignore */
  }
}
