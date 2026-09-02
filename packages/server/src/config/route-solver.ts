/** 外置 Route Solver（OR-Tools Python 服务）配置 */

/**
 * 是否启用 Route Solver 外置服务。
 *
 * @returns 环境变量 `ROUTE_SOLVER_ENABLED=true` 时为 true
 */
export function isRouteSolverEnabled(): boolean {
  return process.env.ROUTE_SOLVER_ENABLED === 'true';
}

/**
 * 获取 Route Solver 服务根 URL（无尾斜杠）。
 *
 * @returns 默认 `http://127.0.0.1:8200`
 */
export function getRouteSolverBaseUrl(): string {
  const raw = (process.env.ROUTE_SOLVER_URL ?? 'http://127.0.0.1:8200').trim();
  return raw.replace(/\/+$/, '');
}

/**
 * 调用外置求解服务的超时毫秒数。
 *
 * @returns 默认 60000
 */
export function getRouteSolverTimeoutMs(): number {
  return parseInt(process.env.ROUTE_SOLVER_TIMEOUT_MS ?? '60000', 10);
}

/**
 * 是否允许调用外置求解服务。
 *
 * @returns 已启用且 URL 非空时为 true
 */
export function canUseRouteSolver(): boolean {
  return isRouteSolverEnabled() && getRouteSolverBaseUrl().length > 0;
}
