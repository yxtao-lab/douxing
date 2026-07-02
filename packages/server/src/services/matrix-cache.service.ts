import {
  getMatrixCacheCoordDecimals,
  getMatrixCacheTtlSec,
  getMatrixEstimateCacheTtlSec,
  isRedisEnabled,
  MATRIX_CACHE_KEY_PREFIX,
} from '../config/redis.js';
import { getRedisClient } from './redis-client.service.js';

/** 路网距离/耗时缓存条目（不含 mode，读取时按场景重算） */
export interface MatrixDistanceCacheEntry {
  distanceMeters: number;
  durationMinutes: number;
  estimated: boolean;
}

const L1_MAX_ENTRIES = 2000;
const L1_TTL_MS = 5 * 60 * 1000;

/** 进程内 L1：同进程热点路段，减少 Redis 往返 */
const l1Cache = new Map<string, { entry: MatrixDistanceCacheEntry; expiresAt: number }>();

/**
 * 按配置精度四舍五入坐标，用于缓存键归一化。
 *
 * @param value - 纬度或经度（WGS84）
 * @returns 固定小数位字符串
 */
function roundCoord(value: number): string {
  return value.toFixed(getMatrixCacheCoordDecimals());
}

/**
 * 构建对称路网缓存键（起终点排序后唯一）。
 *
 * @param fromLat - 起点纬度
 * @param fromLng - 起点经度
 * @param toLat - 终点纬度
 * @param toLng - 终点经度
 * @returns Redis/L1 共用键名
 */
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

/**
 * 从 L1 读取未过期的缓存条目。
 *
 * @param key - `buildMatrixCacheKey` 生成的键
 * @returns 命中条目；过期或不存在时为 `null`
 */
function getL1MatrixCacheEntry(key: string): MatrixDistanceCacheEntry | null {
  const row = l1Cache.get(key);
  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    l1Cache.delete(key);
    return null;
  }
  return row.entry;
}

/**
 * 写入 L1 缓存；超出容量时淘汰最早插入的条目。
 *
 * @param key - 缓存键
 * @param entry - 距离/耗时条目
 * @param ttlMs - 过期毫秒数
 * @returns `void`
 */
function setL1MatrixCacheEntry(
  key: string,
  entry: MatrixDistanceCacheEntry,
  ttlMs: number,
): void {
  if (l1Cache.size >= L1_MAX_ENTRIES && !l1Cache.has(key)) {
    const oldestKey = l1Cache.keys().next().value;
    if (oldestKey) l1Cache.delete(oldestKey);
  }
  l1Cache.set(key, { entry, expiresAt: Date.now() + ttlMs });
}

/**
 * 解析 Redis 原始 JSON 为缓存条目；兼容旧版含 `mode` 字段的数据。
 *
 * @param raw - Redis 字符串值
 * @returns 合法条目；解析失败时为 `null`
 */
function parseMatrixCacheEntry(raw: string): MatrixDistanceCacheEntry | null {
  try {
    const parsed = JSON.parse(raw) as Partial<MatrixDistanceCacheEntry>;
    if (
      typeof parsed.distanceMeters !== 'number' ||
      typeof parsed.durationMinutes !== 'number'
    ) {
      return null;
    }
    return {
      distanceMeters: parsed.distanceMeters,
      durationMinutes: parsed.durationMinutes,
      estimated: parsed.estimated === true,
    };
  } catch {
    return null;
  }
}

/**
 * 读取两点间已缓存的路网距离/耗时（L1 → Redis）。
 *
 * @param fromLat - 起点纬度
 * @param fromLng - 起点经度
 * @param toLat - 终点纬度
 * @param toLng - 终点经度
 * @returns 命中条目；未命中或 Redis 关闭时为 `null`
 */
export async function getCachedTravelDuration(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<MatrixDistanceCacheEntry | null> {
  const key = buildMatrixCacheKey(fromLat, fromLng, toLat, toLng);
  const l1Hit = getL1MatrixCacheEntry(key);
  if (l1Hit) return l1Hit;

  if (!isRedisEnabled()) return null;

  try {
    const redis = await getRedisClient();
    if (!redis) return null;

    const raw = await redis.get(key);
    if (!raw) return null;

    const entry = parseMatrixCacheEntry(raw);
    if (!entry) return null;

    const ttlMs = entry.estimated
      ? getMatrixEstimateCacheTtlSec() * 1000
      : getMatrixCacheTtlSec() * 1000;
    setL1MatrixCacheEntry(key, entry, Math.min(ttlMs, L1_TTL_MS));
    return entry;
  } catch (err) {
    console.warn(
      '[matrix-cache] 读取失败:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 写入两点间路网距离/耗时缓存（L1 + Redis）。
 *
 * @param fromLat - 起点纬度
 * @param fromLng - 起点经度
 * @param toLat - 终点纬度
 * @param toLng - 终点经度
 * @param entry - 距离/耗时；`estimated=true` 时使用较短 TTL
 * @returns `void`；Redis 未启用时仅写 L1
 */
export async function setCachedTravelDuration(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  entry: MatrixDistanceCacheEntry,
): Promise<void> {
  const key = buildMatrixCacheKey(fromLat, fromLng, toLat, toLng);
  const ttlSec = entry.estimated
    ? getMatrixEstimateCacheTtlSec()
    : getMatrixCacheTtlSec();
  setL1MatrixCacheEntry(key, entry, Math.min(ttlSec * 1000, L1_TTL_MS));

  if (!isRedisEnabled()) return;

  try {
    const redis = await getRedisClient();
    if (!redis) return;

    await redis.set(key, JSON.stringify(entry), 'EX', ttlSec);
  } catch (err) {
    console.warn(
      '[matrix-cache] 写入失败:',
      err instanceof Error ? err.message : err,
    );
  }
}
