import { Router } from 'express';
import { z } from 'zod';
import type { LocaleCode } from '@douxing/shared';
import { API_PREFIX, ApiMessageKey, WORKFLOW_GRAPH_SCHEMA_VERSION, type WorkflowGraphDefinition } from '@douxing/shared';
import { authMiddleware, sseAuthMiddleware } from '../middleware/auth.js';
import { requirePerm } from '../middleware/admin.middleware.js';
import { success, fail, failFromError } from '../utils/response.js';
import { getPlanSessionWorkflowTrace, getPlanSessionCostSummary } from '../services/plan-workflow-trace.service.js';
import {
  listRecentPlanSessionsForAdmin,
  runAdminSandboxPlan,
  startAdminSandboxPlanAsync,
  adminPlanSessionExists,
  kickOffPendingAdminSandboxPlan,
} from '../services/plan-admin.service.js';
import { optionalQueryInt } from '../utils/query-coerce.util.js';
import {
  getPlanSessionStreamBuffer,
  subscribePlanSessionStream,
} from '../services/plan-session-stream.service.js';
import { getAgentPlanTimeoutMs } from '../config/agent.js';
import { initSseResponse, writeSseComment, writeSseEvent } from '../utils/sse-response.util.js';

const router = Router();

/** W5 · DAG 图 JSON 校验 schema（沙箱 graphDefOverride） */
const workflowGraphDefSchema = z.custom<WorkflowGraphDefinition>((value) => {
  if (!value || typeof value !== 'object') return false;
  const graph = value as WorkflowGraphDefinition;
  return (
    graph.schemaVersion === WORKFLOW_GRAPH_SCHEMA_VERSION &&
    Array.isArray(graph.nodes) &&
    Array.isArray(graph.edges)
  );
});

const sandboxRunSchema = z.object({
  prompt: z.string().min(2).max(500),
  days: z.number().int().min(1).max(7).optional(),
  budget: z.string().max(64).optional(),
  provider: z.enum(['auto', 'douxing', 'deepseek', 'lmstudio']).optional(),
  graphDefOverride: workflowGraphDefSchema.optional(),
});

router.use(authMiddleware);

function getRequestLocale(res: import('express').Response): LocaleCode {
  return res.locals.locale ?? 'zh-CN';
}

/**
 * W2+：最近规划会话列表（管理端诊断页选用）。
 * GET /api/admin/plan-sessions/recent
 */
router.get('/recent', async (req, res) => {
  try {
    const staff = await requirePerm(req, res, 'data:analytics:view');
    if (!staff) return;

    const parsedLimit = optionalQueryInt(1, 50).safeParse(req.query.limit);
    const limit = parsedLimit.success ? (parsedLimit.data ?? 20) : 20;
    const items = await listRecentPlanSessionsForAdmin(limit);
    success(res, items);
  } catch (err) {
    console.error('[admin/plan-sessions/recent]', err);
    fail(res, ApiMessageKey.PLAN_SESSION_ADMIN_LIST_FAILED);
  }
});

/**
 * W2+：管理端沙箱模拟规划（以当前登录用户身份创建会话）。
 * POST /api/admin/plan-sessions/sandbox-run
 */
router.post('/sandbox-run', async (req, res) => {
  try {
    const staff = await requirePerm(req, res, 'data:analytics:view');
    if (!staff) return;

    const parsed = sandboxRunSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, ApiMessageKey.PARAM_ERROR);
      return;
    }

    const result = await runAdminSandboxPlan(
      req.auth!.userId,
      parsed.data,
      getRequestLocale(res),
    );
    success(res, {
      sessionId: result.sessionId,
      generationSource: result.generationSource,
      llmProvider: result.llmProvider,
      agentState: result.agentState,
    });
  } catch (err) {
    console.error('[admin/plan-sessions/sandbox-run]', err);
    failFromError(res, err, ApiMessageKey.PLAN_SESSION_SANDBOX_RUN_FAILED);
  }
});

/**
 * M2：管理端沙箱异步启动（立即返回 sessionId，后台执行 + SSE 进度）。
 * POST /api/admin/plan-sessions/sandbox-run/async
 */
router.post('/sandbox-run/async', async (req, res) => {
  try {
    const staff = await requirePerm(req, res, 'data:analytics:view');
    if (!staff) return;

    const parsed = sandboxRunSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, ApiMessageKey.PARAM_ERROR);
      return;
    }

    const result = await startAdminSandboxPlanAsync(
      req.auth!.userId,
      parsed.data,
      getRequestLocale(res),
    );
    success(res, result);
  } catch (err) {
    console.error('[admin/plan-sessions/sandbox-run/async]', err);
    failFromError(res, err, ApiMessageKey.PLAN_SESSION_SANDBOX_RUN_FAILED);
  }
});

/**
 * M2：管理端规划沙箱 SSE 流（订阅 tool_call / done / error）。
 * GET /api/admin/plan-sessions/:sessionId/stream
 */
router.get('/:sessionId/stream', sseAuthMiddleware, async (req, res) => {
  try {
    const staff = await requirePerm(req, res, 'data:analytics:view');
    if (!staff) return;

    const sessionId = parseInt(String(req.params.sessionId), 10);
    if (Number.isNaN(sessionId)) {
      fail(res, ApiMessageKey.PARAM_ERROR);
      return;
    }

    const exists = await adminPlanSessionExists(sessionId);
    if (!exists) {
      fail(res, ApiMessageKey.PLAN_SESSION_NOT_FOUND, 404, 404);
      return;
    }

    initSseResponse(res);

    const maxConnMs = getAgentPlanTimeoutMs() + 30_000;
    const connTimer = setTimeout(() => {
      writeSseEvent(res, 'error', { messageKey: ApiMessageKey.REQUEST_TIMEOUT });
      res.end();
    }, maxConnMs);

    const heartbeat = setInterval(() => {
      writeSseComment(res);
    }, 15_000);

    const unsubscribe = subscribePlanSessionStream(sessionId, (envelope) => {
      writeSseEvent(res, envelope.event, envelope.data);
      if (envelope.event === 'done' || envelope.event === 'error') {
        clearTimeout(connTimer);
        clearInterval(heartbeat);
        unsubscribe();
        res.end();
      }
    });

    kickOffPendingAdminSandboxPlan(sessionId);

    for (const buffered of getPlanSessionStreamBuffer(sessionId)) {
      writeSseEvent(res, buffered.event, buffered.data);
      if (buffered.event === 'done' || buffered.event === 'error') {
        clearTimeout(connTimer);
        clearInterval(heartbeat);
        unsubscribe();
        res.end();
        return;
      }
    }

    req.on('close', () => {
      clearTimeout(connTimer);
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (err) {
    console.error('[admin/plan-sessions/stream]', err);
    if (!res.headersSent) {
      fail(res, ApiMessageKey.PLAN_SESSION_DETAIL_FAILED, 500, 500);
      return;
    }
    try {
      writeSseEvent(res, 'error', { messageKey: ApiMessageKey.PLAN_SESSION_DETAIL_FAILED });
      res.end();
    } catch {
      /* 连接可能已断开 */
    }
  }
});

/**
 * W0-5：规划诊断 trace（只读，管理员）。
 * GET /api/admin/plan-sessions/:sessionId/workflow-trace
 */
router.get('/:sessionId/workflow-trace', async (req, res) => {
  try {
    const staff = await requirePerm(req, res, 'data:analytics:view');
    if (!staff) return;

    const sessionId = parseInt(String(req.params.sessionId), 10);
    if (Number.isNaN(sessionId)) {
      fail(res, ApiMessageKey.PARAM_ERROR);
      return;
    }

    const trace = await getPlanSessionWorkflowTrace(sessionId);
    if (!trace) {
      fail(res, ApiMessageKey.PLAN_SESSION_NOT_FOUND, 404, 404);
      return;
    }

    success(res, trace);
  } catch (err) {
    console.error('[admin/plan-sessions/workflow-trace]', err);
    fail(res, ApiMessageKey.PLAN_SESSION_WORKFLOW_TRACE_FAILED);
  }
});

/**
 * W2-6：规划会话费用汇总（只读，管理员）。
 * GET /api/admin/plan-sessions/:sessionId/cost-summary
 */
router.get('/:sessionId/cost-summary', async (req, res) => {
  try {
    const staff = await requirePerm(req, res, 'data:analytics:view');
    if (!staff) return;

    const sessionId = parseInt(String(req.params.sessionId), 10);
    if (Number.isNaN(sessionId)) {
      fail(res, ApiMessageKey.PARAM_ERROR);
      return;
    }

    const summary = await getPlanSessionCostSummary(sessionId);
    if (!summary) {
      fail(res, ApiMessageKey.PLAN_SESSION_NOT_FOUND, 404, 404);
      return;
    }

    success(res, summary);
  } catch (err) {
    console.error('[admin/plan-sessions/cost-summary]', err);
    fail(res, ApiMessageKey.PLAN_SESSION_COST_SUMMARY_FAILED);
  }
});

export default router;
export const adminPlanSessionsMountPath = `${API_PREFIX}/admin/plan-sessions`;
