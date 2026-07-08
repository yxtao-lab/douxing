import { desc, eq } from 'drizzle-orm';
import type {
  CreatePlanSessionRequest,
  LocaleCode,
  PlanSessionActionResult,
  PlanSessionAdminSummary,
} from '@douxing/shared';
import { normalizeAgentToolTrace } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { planSessions } from '../db/schema/plan-sessions.js';
import { users } from '../db/schema/users.js';
import { createPlanSession } from './plan-session.service.js';

/**
 * 将数据库时间戳格式化为 ISO 字符串。
 *
 * @param value - MySQL timestamp
 * @returns ISO 8601 字符串
 */
function toIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

/**
 * 管理端列出最近规划会话（全站，按更新时间倒序）。
 *
 * @param limit - 最大条数；默认 20，上限 50
 * @returns 会话摘要列表
 */
export async function listRecentPlanSessionsForAdmin(
  limit = 20,
): Promise<PlanSessionAdminSummary[]> {
  const db = getDb();
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const rows = await db
    .select({
      id: planSessions.id,
      userId: planSessions.userId,
      username: users.username,
      title: planSessions.title,
      agentState: planSessions.agentState,
      createdAt: planSessions.createdAt,
      updatedAt: planSessions.updatedAt,
    })
    .from(planSessions)
    .leftJoin(users, eq(users.id, planSessions.userId))
    .orderBy(desc(planSessions.updatedAt))
    .limit(safeLimit);

  return rows.map((row) => {
    const agentState = row.agentState as Record<string, unknown> | null;
    const generationPath =
      agentState?.generationPath === 'agent' ? 'agent' : 'pipeline';
    const spans = normalizeAgentToolTrace(agentState?.toolTrace);
    return {
      id: row.id,
      userId: row.userId,
      username: row.username ?? undefined,
      title: row.title,
      generationPath,
      spanCount: spans.length,
      hasToolTrace: spans.length > 0,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  });
}

/**
 * 管理端沙箱模拟规划：以当前登录用户身份创建真实 plan_session（含 toolTrace）。
 *
 * @param userId - 发起模拟的管理员/运营用户 ID
 * @param input - 规划 prompt 与可选参数
 * @param locale - 请求语言
 * @returns 与 C 端 createPlanSession 相同的结果（含 sessionId）
 */
export async function runAdminSandboxPlan(
  userId: number,
  input: CreatePlanSessionRequest,
  locale: LocaleCode,
): Promise<PlanSessionActionResult> {
  return createPlanSession(userId, input, locale);
}
