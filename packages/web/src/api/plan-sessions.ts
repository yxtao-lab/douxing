import http from './http';
import type {
  ApiResponse,
  AdminSandboxPlanRequest,
  CreatePlanSessionRequest,
  PlanSessionAdminSummary,
  PlanSessionCostSummary,
  PlanSessionWorkflowTrace,
} from '@douxing/shared';

const SANDBOX_PLAN_TIMEOUT_MS = 120_000;

/**
 * 获取规划会话 workflow trace（管理端诊断）。
 *
 * @param sessionId - 规划会话 ID
 * @returns NodeSpan 时间线与 Langfuse 深链
 */
export async function fetchPlanSessionWorkflowTrace(sessionId: number) {
  const { data } = await http.get<ApiResponse<PlanSessionWorkflowTrace>>(
    `/admin/plan-sessions/${sessionId}/workflow-trace`,
  );
  return data.data;
}

/**
 * 获取规划会话费用汇总（估算值）。
 *
 * @param sessionId - 规划会话 ID
 * @returns 分节点/分模型费用汇总
 */
export async function fetchPlanSessionCostSummary(sessionId: number) {
  const { data } = await http.get<ApiResponse<PlanSessionCostSummary>>(
    `/admin/plan-sessions/${sessionId}/cost-summary`,
  );
  return data.data;
}

/**
 * 管理端：最近规划会话列表（全站）。
 *
 * @param limit - 最大条数
 * @returns 会话摘要列表
 */
export async function fetchRecentPlanSessions(limit = 20) {
  const { data } = await http.get<ApiResponse<PlanSessionAdminSummary[]>>(
    '/admin/plan-sessions/recent',
    { params: { limit } },
  );
  return data.data;
}

/**
 * 管理端沙箱异步启动（立即返回 sessionId，通过 SSE 订阅进度）。
 *
 * @param body - prompt / days / budget / provider
 * @returns 占位会话 ID
 */
export async function startAdminSandboxPlanAsync(body: AdminSandboxPlanRequest) {
  const { data } = await http.post<ApiResponse<{ sessionId: number }>>(
    '/admin/plan-sessions/sandbox-run/async',
    body,
  );
  return data.data;
}

/**
 * 管理端沙箱模拟规划（以当前登录用户身份，超时 120s）。
 *
 * @param body - prompt / days / budget / provider
 * @returns 新建会话 ID 与生成摘要
 */
export async function runAdminSandboxPlan(body: CreatePlanSessionRequest) {
  const { data } = await http.post<
    ApiResponse<{
      sessionId: number;
      generationSource?: string;
      llmProvider?: string;
      agentState?: unknown;
    }>
  >('/admin/plan-sessions/sandbox-run', body, {
    timeout: SANDBOX_PLAN_TIMEOUT_MS,
  });
  return data.data;
}
