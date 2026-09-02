import http from './http';

export interface RouteSolverNode {
  id: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
  stayMinutes?: number;
  windowStart?: number | null;
  windowEnd?: number | null;
}

export interface RouteSolverOptions {
  preset?: 'balanced' | 'fast' | 'quality' | 'open_hours' | null;
  timeLimitSeconds?: number;
  firstSolution?: string;
  metaheuristic?: string;
  returnToDepot?: boolean;
  travelTimeWeight?: number;
  distanceWeight?: number;
  enableTimeWindows?: boolean;
  depotStartMinutes?: number;
  waitingSlackMinutes?: number;
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

export interface RouteSolverStatus {
  enabled: boolean;
  health: {
    service: string;
    version: string;
    ortoolsAvailable: boolean;
  } | null;
}

export interface RouteSolverFactorCatalog {
  presets: Array<{
    id: string;
    label: string;
    description: string;
    options: RouteSolverOptions;
  }>;
  factors: Array<{
    key: string;
    label: string;
    description: string;
    type: 'enum' | 'number' | 'boolean';
    recommended?: boolean;
    options?: Array<{ value: string; label: string; recommended?: boolean }>;
    min?: number;
    max?: number;
    step?: number;
    default?: string | number | boolean;
  }>;
}

/**
 * 查询外置路径求解服务状态。
 *
 * @returns 是否启用及 health 信息
 */
export async function fetchRouteSolverStatus(): Promise<RouteSolverStatus> {
  const { data } = await http.get<{ data: RouteSolverStatus }>('/admin/route-solver/status');
  return data.data;
}

/**
 * 拉取推荐影响因素目录。
 *
 * @returns 预设与因子定义
 */
export async function fetchRouteSolverFactors(): Promise<RouteSolverFactorCatalog> {
  const { data } = await http.get<{ data: RouteSolverFactorCatalog }>(
    '/admin/route-solver/factors',
  );
  return data.data;
}

/**
 * 调用管理端代理求解最佳路线顺序。
 *
 * @param body - 节点与求解选项
 * @returns 求解结果
 */
export async function solveRouteSolverLab(body: {
  nodes: RouteSolverNode[];
  durationMatrix?: number[][] | null;
  options?: RouteSolverOptions;
}): Promise<RouteSolverSolveResult> {
  const { data } = await http.post<{ data: RouteSolverSolveResult }>(
    '/admin/route-solver/solve',
    body,
    { timeout: 90000 },
  );
  return data.data;
}
