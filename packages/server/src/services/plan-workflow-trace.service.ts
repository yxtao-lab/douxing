import { eq } from 'drizzle-orm';
import type { AgentToolTraceEntry, PlanSessionWorkflowTrace } from '@douxing/shared';
import { normalizeAgentToolTrace } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { planSessions } from '../db/schema/plan-sessions.js';

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
  const spans: AgentToolTraceEntry[] = normalizeAgentToolTrace(agentState?.toolTrace);
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
  };
}
