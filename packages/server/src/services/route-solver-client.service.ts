import { ApiError, ApiMessageKey } from '@douxing/shared';
import {
  canUseRouteSolver,
  getRouteSolverBaseUrl,
  getRouteSolverTimeoutMs,
} from '../config/route-solver.js';

/**
 * 带超时的 fetch。
 *
 * @param url - 完整 URL
 * @param init - fetch 初始化参数
 * @param timeoutMs - 超时毫秒
 * @returns Response
 */
async function fetchRouteSolver(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface RouteSolverHealth {
  service: string;
  version: string;
  ortoolsAvailable: boolean;
}

export interface RouteSolverFactorCatalog {
  presets: unknown[];
  factors: unknown[];
}

export interface RouteSolverSolveBody {
  nodes: Array<{
    id: string;
    name: string;
    lat?: number | null;
    lng?: number | null;
    stayMinutes?: number;
    windowStart?: number | null;
    windowEnd?: number | null;
  }>;
  durationMatrix?: number[][] | null;
  options?: Record<string, unknown>;
}

export interface RouteSolverSolveResult {
  order: number[];
  orderIds: string[];
  orderNames: string[];
  totalCost: number;
  costUnit: string;
  appliedFactors: Array<{ key: string; label: string; value: string }>;
  matrixSource: string;
  solveMs: number;
}

/**
 * 查询外置 Route Solver 健康状态。
 *
 * @returns 健康信息
 * @throws {ApiError} ROUTE_SOLVER_DISABLED / ROUTE_SOLVER_UNAVAILABLE
 */
export async function fetchRouteSolverHealth(): Promise<RouteSolverHealth> {
  if (!canUseRouteSolver()) {
    throw new ApiError(ApiMessageKey.ROUTE_SOLVER_DISABLED);
  }
  const base = getRouteSolverBaseUrl();
  const timeoutMs = getRouteSolverTimeoutMs();
  try {
    const res = await fetchRouteSolver(`${base}/health`, { method: 'GET' }, timeoutMs);
    if (!res.ok) {
      throw new ApiError(ApiMessageKey.ROUTE_SOLVER_UNAVAILABLE);
    }
    return (await res.json()) as RouteSolverHealth;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(ApiMessageKey.ROUTE_SOLVER_UNAVAILABLE);
  }
}

/**
 * 拉取推荐影响因素目录。
 *
 * @returns 预设与因子定义
 * @throws {ApiError} 未启用或服务不可用
 */
export async function fetchRouteSolverFactors(): Promise<RouteSolverFactorCatalog> {
  if (!canUseRouteSolver()) {
    throw new ApiError(ApiMessageKey.ROUTE_SOLVER_DISABLED);
  }
  const base = getRouteSolverBaseUrl();
  const timeoutMs = getRouteSolverTimeoutMs();
  try {
    const res = await fetchRouteSolver(`${base}/v1/route/factors`, { method: 'GET' }, timeoutMs);
    if (!res.ok) {
      throw new ApiError(ApiMessageKey.ROUTE_SOLVER_UNAVAILABLE);
    }
    return (await res.json()) as RouteSolverFactorCatalog;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(ApiMessageKey.ROUTE_SOLVER_UNAVAILABLE);
  }
}

/**
 * 调用外置服务求解一日路线顺序。
 *
 * @param body - 与 Python `/v1/route/solve` 对齐的请求体
 * @returns 求解结果
 * @throws {ApiError} 未启用、不可用或求解失败
 */
export async function solveRouteWithExternalSolver(
  body: RouteSolverSolveBody,
): Promise<RouteSolverSolveResult> {
  if (!canUseRouteSolver()) {
    throw new ApiError(ApiMessageKey.ROUTE_SOLVER_DISABLED);
  }
  const base = getRouteSolverBaseUrl();
  const timeoutMs = getRouteSolverTimeoutMs();
  try {
    const res = await fetchRouteSolver(
      `${base}/v1/route/solve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
    if (res.status === 400) {
      throw new ApiError(ApiMessageKey.ROUTE_SOLVER_SOLVE_FAILED);
    }
    if (!res.ok) {
      throw new ApiError(ApiMessageKey.ROUTE_SOLVER_UNAVAILABLE);
    }
    return (await res.json()) as RouteSolverSolveResult;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(ApiMessageKey.ROUTE_SOLVER_UNAVAILABLE);
  }
}
