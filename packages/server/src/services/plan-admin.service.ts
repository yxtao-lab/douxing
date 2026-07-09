import { desc, eq } from 'drizzle-orm';
import type {
  AdminSandboxPlanRequest,
  LocaleCode,
  PlanSessionActionResult,
  PlanSessionAdminSummary,
} from '@douxing/shared';
import { ApiError, ApiMessageKey, isApiError, normalizeAgentToolTrace, PlanSessionStatus, validateWorkflowGraph } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { planSessions } from '../db/schema/plan-sessions.js';
import { users } from '../db/schema/users.js';
import {
  createPlanSession,
  type CreatePlanSessionStreamOptions,
} from './plan-session.service.js';
import {
  beginPlanSessionGeneration,
  emitPlanSessionToolCall,
  failPlanSessionStream,
} from './plan-session-stream.service.js';

const SESSION_TITLE_MAX = 40;

/**
 * 将 prompt 截断为会话标题。
 *
 * @param text - 原始 prompt
 * @returns 截断后的标题
 */
function truncateSessionTitle(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= SESSION_TITLE_MAX) return trimmed;
  return `${trimmed.slice(0, SESSION_TITLE_MAX)}…`;
}

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
  input: AdminSandboxPlanRequest,
  locale: LocaleCode,
): Promise<PlanSessionActionResult> {
  return createPlanSession(userId, input, locale);
}

/** 管理端沙箱异步启动结果 */
export interface AdminSandboxPlanStreamStartResult {
  sessionId: number;
}

interface PendingAdminSandboxRun {
  userId: number;
  input: AdminSandboxPlanRequest;
  locale: LocaleCode;
}

/** 等待 SSE 订阅后再启动的沙箱任务 */
const pendingAdminSandboxRuns = new Map<number, PendingAdminSandboxRun>();
const pendingAdminSandboxTimers = new Map<number, ReturnType<typeof setTimeout>>();

/** 无 SSE 订阅时的沙箱启动兜底延迟（毫秒） */
const SANDBOX_STREAM_START_FALLBACK_MS = 4000;

/**
 * 在首个 SSE 订阅或超时后启动挂起的沙箱规划。
 *
 * @param sessionId - 沙箱会话 ID
 * @returns 是否成功触发后台规划
 */
export function kickOffPendingAdminSandboxPlan(sessionId: number): boolean {
  const pending = pendingAdminSandboxRuns.get(sessionId);
  if (!pending) return false;

  pendingAdminSandboxRuns.delete(sessionId);
  const timer = pendingAdminSandboxTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    pendingAdminSandboxTimers.delete(sessionId);
  }

  void completeAdminSandboxPlanInBackground(
    pending.userId,
    pending.input,
    pending.locale,
    sessionId,
  );
  return true;
}

/**
 * 登记沙箱后台任务，待 SSE 订阅连接后再执行（避免事件缓冲突发回放）。
 *
 * @param sessionId - 沙箱会话 ID
 * @param userId - 用户 ID
 * @param input - 规划请求
 * @param locale - 语言
 */
function schedulePendingAdminSandboxPlan(
  sessionId: number,
  userId: number,
  input: AdminSandboxPlanRequest,
  locale: LocaleCode,
): void {
  pendingAdminSandboxRuns.set(sessionId, { userId, input, locale });
  pendingAdminSandboxTimers.set(
    sessionId,
    setTimeout(() => {
      kickOffPendingAdminSandboxPlan(sessionId);
    }, SANDBOX_STREAM_START_FALLBACK_MS),
  );
}

/**
 * 后台完成沙箱规划并推送 SSE 结束事件。
 *
 * @param userId - 用户 ID
 * @param input - 规划请求
 * @param locale - 语言
 * @param existingSessionId - 占位会话 ID
 */
async function completeAdminSandboxPlanInBackground(
  userId: number,
  input: AdminSandboxPlanRequest,
  locale: LocaleCode,
  existingSessionId: number,
): Promise<void> {
  const streamOptions: CreatePlanSessionStreamOptions = { existingSessionId };
  try {
    emitPlanSessionToolCall(existingSessionId, { tool: 'thinking', status: 'done', ms: 0 });
    await createPlanSession(userId, input, locale, streamOptions);
  } catch (err) {
    console.error('[admin/sandbox-run/async]', err);
    if (isApiError(err)) {
      failPlanSessionStream(existingSessionId, err.messageKey, err.params);
      return;
    }
    failPlanSessionStream(existingSessionId, ApiMessageKey.PLAN_SESSION_SANDBOX_RUN_FAILED);
  }
}

/**
 * 管理端沙箱异步启动：立即返回 sessionId，规划在后台执行并通过 SSE 推送进度。
 *
 * @param userId - 发起模拟的管理员/运营用户 ID
 * @param input - 规划 prompt 与可选参数
 * @param locale - 请求语言
 * @returns 占位会话 ID，客户端应订阅 SSE
 * @throws {ApiError} prompt 为空时
 */
export async function startAdminSandboxPlanAsync(
  userId: number,
  input: AdminSandboxPlanRequest,
  locale: LocaleCode,
): Promise<AdminSandboxPlanStreamStartResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new ApiError(ApiMessageKey.PLAN_PROMPT_REQUIRED);
  }

  if (input.graphDefOverride) {
    const validation = validateWorkflowGraph(input.graphDefOverride);
    if (!validation.valid) {
      throw new ApiError(ApiMessageKey.WORKFLOW_GRAPH_VALIDATION_FAILED);
    }
  }

  const db = getDb();
  const [insertResult] = await db.insert(planSessions).values({
    userId,
    routeId: null,
    provider: input.provider ?? 'auto',
    status: PlanSessionStatus.ACTIVE,
    title: truncateSessionTitle(prompt),
    agentState: {
      lastRoutedIntent: 'plan_new',
      generationPath: 'agent',
      toolTrace: [],
    },
  });
  const sessionId = Number(insertResult.insertId);

  beginPlanSessionGeneration(sessionId);
  emitPlanSessionToolCall(sessionId, { tool: 'thinking', status: 'running' });

  schedulePendingAdminSandboxPlan(sessionId, userId, input, locale);

  return { sessionId };
}

/**
 * 管理端校验规划会话是否存在（不校验归属用户）。
 *
 * @param sessionId - 会话 ID
 * @returns 是否存在
 */
export async function adminPlanSessionExists(sessionId: number): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: planSessions.id })
    .from(planSessions)
    .where(eq(planSessions.id, sessionId))
    .limit(1);
  return rows.length > 0;
}
