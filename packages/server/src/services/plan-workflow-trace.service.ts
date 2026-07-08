import { eq } from 'drizzle-orm';
import type {
  AgentToolTraceEntry,
  PlanSessionCostSummary,
  PlanSessionWorkflowTrace,
} from '@douxing/shared';
import { normalizeAgentToolTrace } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { planSessions } from '../db/schema/plan-sessions.js';
import { buildLangfuseSessionUrl } from '../observability/langfuse-client.service.js';
import {
  enrichSpansWithEstimatedCost,
  summarizeWorkflowCost,
} from './workflow-cost.service.js';

/**
 * 管理端读取规划会话 workflow trace（NodeSpan 时间线）。
 *
 * @param sessionId - 规划会话 ID
 * @returns 时间线摘要；会话不存在时返回 null
 */
export async function getPlanSessionWorkflowTrace(
  sessionId: number,
): Promise<PlanSessionWorkflowTrace | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(planSessions)
    .where(eq(planSessions.id, sessionId))
    .limit(1);
  const session = rows[0];
  if (!session) return null;

  const agentState = session.agentState as Record<string, unknown> | null;
  const spans: AgentToolTraceEntry[] = enrichSpansWithEstimatedCost(
    normalizeAgentToolTrace(agentState?.toolTrace),
  );
  const generationPath = agentState?.generationPath === 'agent' ? 'agent' : 'pipeline';
  const lastRoutedIntent =
    typeof agentState?.lastRoutedIntent === 'string' ? agentState.lastRoutedIntent : 'unknown';
  const totalDurationMs = spans.reduce((sum, span) => sum + span.ms, 0);

  return {
    sessionId: session.id,
    userId: session.userId,
    title: session.title ?? '',
    generationPath,
    lastRoutedIntent,
    spans,
    totalDurationMs,
    langfuseSessionId: String(session.id),
    langfuseSessionUrl: buildLangfuseSessionUrl(session.id),
  };
}

/**
 * 管理端读取规划会话费用汇总（基于 agent_state.toolTrace 估算）。
 *
 * @param sessionId - 规划会话 ID
 * @returns 费用汇总；会话不存在时返回 null
 */
export async function getPlanSessionCostSummary(
  sessionId: number,
): Promise<PlanSessionCostSummary | null> {
  const trace = await getPlanSessionWorkflowTrace(sessionId);
  if (!trace) return null;
  return summarizeWorkflowCost(sessionId, trace.spans);
}
