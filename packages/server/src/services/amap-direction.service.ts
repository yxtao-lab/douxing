import { haversineDistanceMeters, interpolateSegment } from '@douxing/shared';
import type { RoutePathSegmentMode, RouteTransitMode } from '@douxing/shared';
import {
  getAmapWebKey,
  getAmapGeocodeTimeoutMs,
  getAmapDirectionConcurrency,
  isAmapGeocodeEnabled,
} from '../config/amap.js';
import { recordExternalApiCall } from '../observability/external-api-counter.service.js';
import {
  getCachedTravelDuration,
  setCachedTravelDuration,
  type MatrixDistanceCacheEntry,
} from './matrix-cache.service.js';
import {
  getCachedDirectionPolyline,
  setCachedDirectionPolyline,
} from './polyline-cache.service.js';

const AMAP_DISTANCE_URL = 'https://restapi.amap.com/v3/distance';
const AMAP_WALKING_URL = 'https://restapi.amap.com/v3/direction/walking';
const AMAP_DRIVING_URL = 'https://restapi.amap.com/v3/direction/driving';

/** 步行距离阈值（米），低于此值优先步行 */
export const WALK_DISTANCE_THRESHOLD_M = 800;

/** 默认 POI 游玩时长（分钟） */
export const DEFAULT_VISIT_MINUTES = 90;

/** 默认每日开始时刻（分钟，09:00） */
export const DEFAULT_DAY_START_MINUTES = 9 * 60;

export interface LatLngPoint {
  latitude: number;
  longitude: number;
}

export interface TravelDurationResult {
  durationMinutes: number;
  distanceMeters: number;
  mode: RouteTransitMode;
  estimated: boolean;
}

export interface DirectionPolylineResult {
  points: LatLngPoint[];
  mode: RoutePathSegmentMode;
  estimated: boolean;
  distanceMeters?: number;
  durationMinutes?: number;
}

interface AmapDistanceResponse {
  status?: string;
  info?: string;
  results?: Array<{ distance?: string; duration?: string }>;
}

interface AmapDirectionStep {
  polyline?: string;
}

interface AmapDirectionPath {
  distance?: string;
  duration?: string;
  steps?: AmapDirectionStep[];
}

interface AmapDirectionResponse {
  status?: string;
  info?: string;
  route?: {
    paths?: AmapDirectionPath[];
  };
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type SemaphoreRelease = () => void;

/**
 * 创建异步信号量，限制同时执行的异步任务数量。
 *
 * @param maxConcurrent - 最大并发数；小于 1 时按 1 处理
 * @returns `acquire` 获取槽位（满则排队）；`release` 释放槽位
 */
function createAsyncSemaphore(maxConcurrent: number): {
  acquire: () => Promise<void>;
  release: SemaphoreRelease;
} {
  const limit = Math.max(1, maxConcurrent);
  let activeCount = 0;
  const waitQueue: Array<() => void> = [];

  const release: SemaphoreRelease = () => {
    activeCount -= 1;
    const next = waitQueue.shift();
    if (next) next();
  };

  const acquire = (): Promise<void> => {
    if (activeCount < limit) {
      activeCount += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      waitQueue.push(() => {
        activeCount += 1;
        resolve();
      });
    });
  };

  return { acquire, release };
}

/** 高德 direction/distance Web API 并发闸门（进程内单例，distance 与 polyline 共用） */
let amapDirectionRequestSemaphore: ReturnType<typeof createAsyncSemaphore> | null = null;

/**
 * 获取高德路网 API 并发闸门；上限由 `AMAP_DIRECTION_CONCURRENCY` 控制。
 *
 * @returns 模块级共享信号量实例
 */
function getAmapDirectionRequestSemaphore(): ReturnType<typeof createAsyncSemaphore> {
  if (!amapDirectionRequestSemaphore) {
    amapDirectionRequestSemaphore = createAsyncSemaphore(getAmapDirectionConcurrency());
  }
  return amapDirectionRequestSemaphore;
}

/**
 * 在路网 API 并发闸门内执行异步任务（distance + direction polyline 共用）。
 *
 * @param task - 需限流的高德 HTTP 请求逻辑
 * @returns `task` 的返回值
 */
async function runWithAmapDirectionConcurrency<T>(task: () => Promise<T>): Promise<T> {
  const semaphore = getAmapDirectionRequestSemaphore();
  await semaphore.acquire();
  try {
    return await task();
  } finally {
    semaphore.release();
  }
}

function estimateByHaversine(from: LatLngPoint, to: LatLngPoint): TravelDurationResult {
  const distanceMeters = haversineDistanceMeters(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
  );
  const mode: RouteTransitMode = distanceMeters <= WALK_DISTANCE_THRESHOLD_M ? 'walk' : 'drive';
  const speedMps = mode === 'walk' ? 1.2 : 8.3;
  const durationMinutes = Math.max(5, Math.round(distanceMeters / speedMps / 60));
  return {
    durationMinutes,
    distanceMeters: Math.round(distanceMeters),
    mode,
    estimated: true,
  };
}

export interface TravelDurationOptions {
  /** H9-4：playbook 建议的交通方式，优先于距离规则 */
  preferredMode?: RouteTransitMode;
  /** H9-4：景区簇内（如西湖），短距优先步行/观光车 */
  scenicCluster?: boolean;
}

function pickLocalTransitMode(
  distanceMeters: number,
  durationMinutes: number,
  options?: TravelDurationOptions,
): RouteTransitMode {
  if (options?.preferredMode) return options.preferredMode;

  if (options?.scenicCluster) {
    if (distanceMeters <= 2500) return 'walk';
    return 'bus';
  }

  if (distanceMeters <= WALK_DISTANCE_THRESHOLD_M) return 'walk';
  if (distanceMeters <= 3000) return 'walk';
  if (distanceMeters <= 5000 && durationMinutes <= 20) return 'taxi';
  if (distanceMeters <= 10000) return 'bus';
  return 'drive';
}

/**
 * 由缓存的距离/耗时条目组装最终结果，并按当前场景重算交通方式。
 *
 * @param cached - L1/Redis 命中的距离/耗时
 * @param options - 玩法动线或 playbook 交通偏好
 * @returns 含 `mode` 的完整耗时结果
 */
function buildTravelDurationFromCache(
  cached: MatrixDistanceCacheEntry,
  options?: TravelDurationOptions,
): TravelDurationResult {
  return {
    distanceMeters: cached.distanceMeters,
    durationMinutes: cached.durationMinutes,
    estimated: cached.estimated,
    mode: pickLocalTransitMode(cached.distanceMeters, cached.durationMinutes, options),
  };
}

/**
 * 写入 Haversine 估算缓存，避免 CUQPS 等失败时对同路段重复打 API。
 *
 * @param from - 起点
 * @param to - 终点
 * @param result - 已含 `mode` 的估算结果
 * @returns `void`
 */
async function cacheEstimatedTravelDuration(
  from: LatLngPoint,
  to: LatLngPoint,
  result: TravelDurationResult,
): Promise<void> {
  await setCachedTravelDuration(from.latitude, from.longitude, to.latitude, to.longitude, {
    distanceMeters: result.distanceMeters,
    durationMinutes: result.durationMinutes,
    estimated: true,
  });
}

/** @deprecated 使用 pickLocalTransitMode；保留命名供内部调用 */
function pickModeFromDistance(
  distanceMeters: number,
  durationMinutes: number,
  options?: TravelDurationOptions,
): RouteTransitMode {
  return pickLocalTransitMode(distanceMeters, durationMinutes, options);
}

/**
 * 调用高德 distance API 查询驾车距离与耗时；失败时返回 `null` 由上层降级 Haversine。
 *
 * @param from - 起点坐标
 * @param to - 终点坐标
 * @returns 成功时为精确结果；API 失败或数据无效时为 `null`
 */
async function fetchTravelDurationFromAmapDistance(
  from: LatLngPoint,
  to: LatLngPoint,
  options?: TravelDurationOptions,
): Promise<TravelDurationResult | null> {
  const key = getAmapWebKey();
  if (!key || !isAmapGeocodeEnabled()) return null;

  const origins = `${from.longitude},${from.latitude}`;
  const destination = `${to.longitude},${to.latitude}`;
  const params = new URLSearchParams({
    key,
    origins,
    destination,
    type: '1',
  });

  try {
    const timeoutMs = getAmapGeocodeTimeoutMs();
    recordExternalApiCall();
    const res = await fetchWithTimeout(`${AMAP_DISTANCE_URL}?${params}`, timeoutMs);
    const data = (await res.json()) as AmapDistanceResponse;

    if (data.status !== '1' || !data.results?.[0]) {
      console.warn('[amap-direction] distance 无结果:', data.info ?? res.status);
      return null;
    }

    const distanceMeters = parseInt(data.results[0].distance ?? '0', 10);
    const durationSec = parseInt(data.results[0].duration ?? '0', 10);
    if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSec) || durationSec <= 0) {
      return null;
    }

    const durationMinutes = Math.max(5, Math.round(durationSec / 60));
    const cacheEntry: MatrixDistanceCacheEntry = {
      distanceMeters,
      durationMinutes,
      estimated: false,
    };
    await setCachedTravelDuration(
      from.latitude,
      from.longitude,
      to.latitude,
      to.longitude,
      cacheEntry,
    );
    return buildTravelDurationFromCache(cacheEntry, options);
  } catch (err) {
    console.warn(
      '[amap-direction] distance 请求失败:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 查询两点间驾车耗时（高德 distance API，type=1 驾车）
 * @see https://lbs.amap.com/api/webservice/guide/api/direction#distance
 */
export async function getTravelDuration(
  from: LatLngPoint,
  to: LatLngPoint,
  options?: TravelDurationOptions,
): Promise<TravelDurationResult> {
  const cached = await getCachedTravelDuration(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
  );
  if (cached) {
    return buildTravelDurationFromCache(cached, options);
  }

  const key = getAmapWebKey();
  if (!key || !isAmapGeocodeEnabled()) {
    const estimated = estimateByHaversine(from, to);
    const result = {
      ...estimated,
      mode: pickLocalTransitMode(estimated.distanceMeters, estimated.durationMinutes, options),
    };
    await cacheEstimatedTravelDuration(from, to, result);
    return result;
  }

  const fromAmap = await runWithAmapDirectionConcurrency(() =>
    fetchTravelDurationFromAmapDistance(from, to, options),
  );
  if (fromAmap) return fromAmap;

  const estimated = estimateByHaversine(from, to);
  const result = {
    ...estimated,
    mode: pickLocalTransitMode(estimated.distanceMeters, estimated.durationMinutes, options),
  };
  await cacheEstimatedTravelDuration(from, to, result);
  return result;
}

/** 构建 N 点 pairwise 耗时矩阵（对称缓存复用） */
export async function buildDurationMatrix(
  points: LatLngPoint[],
): Promise<number[][]> {
  const n = points.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const result = await getTravelDuration(points[i]!, points[j]!);
      matrix[i]![j] = result.durationMinutes;
      matrix[j]![i] = result.durationMinutes;
    }
  }
  return matrix;
}

function tourCost(matrix: number[][], order: number[]): number {
  let cost = 0;
  for (let i = 0; i < order.length - 1; i += 1) {
    cost += matrix[order[i]!]![order[i + 1]!]!;
  }
  return cost;
}

function twoOptImprove(matrix: number[][], order: number[]): number[] {
  const next = [...order];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < next.length - 2; i += 1) {
      for (let k = i + 1; k < next.length - 1; k += 1) {
        const a = next[i]!;
        const b = next[i + 1]!;
        const c = next[k]!;
        const d = next[k + 1]!;
        const before = matrix[a]![b]! + matrix[c]![d]!;
        const after = matrix[a]![c]! + matrix[b]![d]!;
        if (after + 0.01 < before) {
          const reversed = next.slice(i + 1, k + 1).reverse();
          next.splice(i + 1, k - i, ...reversed);
          improved = true;
        }
      }
    }
  }
  return next;
}

function nearestNeighborTour(matrix: number[][], startIndex: number): number[] {
  const n = matrix.length;
  const visited = new Set<number>([startIndex]);
  const order = [startIndex];
  let current = startIndex;

  while (visited.size < n) {
    let bestNext = -1;
    let bestCost = Infinity;
    for (let j = 0; j < n; j += 1) {
      if (visited.has(j)) continue;
      const cost = matrix[current]![j]!;
      if (cost < bestCost) {
        bestCost = cost;
        bestNext = j;
      }
    }
    if (bestNext < 0) break;
    visited.add(bestNext);
    order.push(bestNext);
    current = bestNext;
  }
  return order;
}

function buildPoiSubMatrix(fullMatrix: number[][], poiCount: number): number[][] {
  const matrix: number[][] = Array.from({ length: poiCount }, () => Array(poiCount).fill(0));
  for (let i = 0; i < poiCount; i += 1) {
    for (let j = 0; j < poiCount; j += 1) {
      matrix[i]![j] = fullMatrix[i + 1]![j + 1]!;
    }
  }
  return matrix;
}

/** 最近邻 + 2-opt；多起点取总耗时最短 */
export async function optimizeVisitOrder(points: LatLngPoint[]): Promise<number[]> {
  const n = points.length;
  if (n <= 1) return points.map((_, i) => i);
  if (n === 2) return [0, 1];

  const matrix = await buildDurationMatrix(points);

  let bestOrder = twoOptImprove(matrix, nearestNeighborTour(matrix, 0));
  let bestCost = tourCost(matrix, bestOrder);

  for (let start = 1; start < n; start += 1) {
    const candidate = twoOptImprove(matrix, nearestNeighborTour(matrix, start));
    const cost = tourCost(matrix, candidate);
    if (cost < bestCost) {
      bestCost = cost;
      bestOrder = candidate;
    }
  }

  return bestOrder;
}

/**
 * 以酒店/出发点为 depot 优化 POI 访问顺序
 * 返回 POI 在 poiPoints 中的下标顺序
 */
export async function optimizePoiOrderFromDepot(
  depot: LatLngPoint,
  poiPoints: LatLngPoint[],
): Promise<number[]> {
  const poiCount = poiPoints.length;
  if (poiCount === 0) return [];
  if (poiCount === 1) return [0];

  const allPoints = [depot, ...poiPoints];
  const matrix = await buildDurationMatrix(allPoints);
  const poiMatrix = buildPoiSubMatrix(matrix, poiCount);

  let bestOrder: number[] = [];
  let bestCost = Infinity;

  for (let firstPoi = 0; firstPoi < poiCount; firstPoi += 1) {
    const visited = new Set<number>([firstPoi]);
    const order = [firstPoi];
    let current = firstPoi + 1;

    while (order.length < poiCount) {
      let bestNext = -1;
      let bestLeg = Infinity;
      for (let poiIdx = 0; poiIdx < poiCount; poiIdx += 1) {
        if (visited.has(poiIdx)) continue;
        const leg = matrix[current]![poiIdx + 1]!;
        if (leg < bestLeg) {
          bestLeg = leg;
          bestNext = poiIdx;
        }
      }
      if (bestNext < 0) break;
      visited.add(bestNext);
      order.push(bestNext);
      current = bestNext + 1;
    }

    const improved = twoOptImprove(poiMatrix, order);
    const cost = matrix[0]![improved[0]! + 1]! + tourCost(poiMatrix, improved);

    if (cost < bestCost) {
      bestCost = cost;
      bestOrder = improved;
    }
  }

  return bestOrder.length > 0 ? bestOrder : poiPoints.map((_, i) => i);
}

export function formatMinutesToTime(minutes: number): string {
  const safe = Math.max(0, Math.min(minutes, 24 * 60 - 1));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTimeRange(startMinutes: number, endMinutes: number): string {
  return `${formatMinutesToTime(startMinutes)}-${formatMinutesToTime(endMinutes)}`;
}

function isIntercityTransitMode(mode?: RouteTransitMode | null): boolean {
  return mode === 'train' || mode === 'flight';
}

function resolveDirectionApiMode(transitMode?: RouteTransitMode | null): 'walk' | 'drive' {
  if (transitMode === 'walk') return 'walk';
  return 'drive';
}

function resolveSegmentMode(transitMode?: RouteTransitMode | null): RoutePathSegmentMode {
  if (transitMode === 'walk') return 'walk';
  if (isIntercityTransitMode(transitMode)) return 'straight';
  return 'drive';
}

/** 解析高德 direction steps 中的 polyline（lng,lat;lng,lat） */
export function parseAmapPolyline(polyline: string): LatLngPoint[] {
  const points: LatLngPoint[] = [];
  for (const chunk of polyline.split(';')) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const [lngRaw, latRaw] = trimmed.split(',');
    const lng = parseFloat(lngRaw ?? '');
    const lat = parseFloat(latRaw ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const last = points[points.length - 1];
    if (last && last.latitude === lat && last.longitude === lng) continue;
    points.push({ latitude: lat, longitude: lng });
  }
  return points;
}

function buildStraightPolyline(from: LatLngPoint, to: LatLngPoint): DirectionPolylineResult {
  const distanceMeters = haversineDistanceMeters(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
  );
  return {
    points: interpolateSegment(from, to, 20),
    mode: 'straight',
    estimated: true,
    distanceMeters: Math.round(distanceMeters),
  };
}

async function fetchDirectionPolylineFromAmap(
  from: LatLngPoint,
  to: LatLngPoint,
  apiMode: 'walk' | 'drive',
): Promise<DirectionPolylineResult | null> {
  const key = getAmapWebKey();
  if (!key || !isAmapGeocodeEnabled()) return null;

  const origin = `${from.longitude},${from.latitude}`;
  const destination = `${to.longitude},${to.latitude}`;
  const baseUrl = apiMode === 'walk' ? AMAP_WALKING_URL : AMAP_DRIVING_URL;
  const params = new URLSearchParams({ key, origin, destination });

  try {
    const timeoutMs = getAmapGeocodeTimeoutMs();
    recordExternalApiCall();
    const res = await fetchWithTimeout(`${baseUrl}?${params}`, timeoutMs);
    const data = (await res.json()) as AmapDirectionResponse;

    if (data.status !== '1' || !data.route?.paths?.[0]) {
      console.warn('[amap-direction] direction 无结果:', data.info ?? res.status);
      return null;
    }

    const path = data.route.paths[0]!;
    const points: LatLngPoint[] = [];
    for (const step of path.steps ?? []) {
      if (!step.polyline) continue;
      for (const point of parseAmapPolyline(step.polyline)) {
        const last = points[points.length - 1];
        if (last && last.latitude === point.latitude && last.longitude === point.longitude) {
          continue;
        }
        points.push(point);
      }
    }

    if (points.length < 2) return null;

    const distanceMeters = parseInt(path.distance ?? '0', 10);
    const durationSec = parseInt(path.duration ?? '0', 10);

    return {
      points,
      mode: apiMode,
      estimated: false,
      distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : undefined,
      durationMinutes:
        Number.isFinite(durationSec) && durationSec > 0
          ? Math.max(1, Math.round(durationSec / 60))
          : undefined,
    };
  } catch (err) {
    console.warn(
      '[amap-direction] direction 请求失败:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * H9-2：查询两点间路网 polyline（步行/驾车 direction API，跨城降级直线）
 */
export async function getDirectionPolyline(
  from: LatLngPoint,
  to: LatLngPoint,
  transitMode?: RouteTransitMode | null,
): Promise<DirectionPolylineResult> {
  if (isIntercityTransitMode(transitMode)) {
    return buildStraightPolyline(from, to);
  }

  const apiMode = resolveDirectionApiMode(transitMode);
  const segmentMode = resolveSegmentMode(transitMode);

  const cached = await getCachedDirectionPolyline(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
    apiMode,
  );
  if (cached) {
    return { ...cached, mode: segmentMode };
  }

  const fromAmap = await runWithAmapDirectionConcurrency(() =>
    fetchDirectionPolylineFromAmap(from, to, apiMode),
  );
  if (fromAmap) {
    const result: DirectionPolylineResult = { ...fromAmap, mode: segmentMode };
    await setCachedDirectionPolyline(
      from.latitude,
      from.longitude,
      to.latitude,
      to.longitude,
      apiMode,
      result,
    );
    return result;
  }

  const fallback = buildStraightPolyline(from, to);
  return { ...fallback, mode: segmentMode };
}
