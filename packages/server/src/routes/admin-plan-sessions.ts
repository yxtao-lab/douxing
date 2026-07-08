import { Router } from 'express';
import { z } from 'zod';
import type { LocaleCode } from '@douxing/shared';
import { API_PREFIX, ApiMessageKey } from '@douxing/shared';
import { authMiddleware } from '../middleware/auth.js';
import { requirePerm } from '../middleware/admin.middleware.js';
import { success, fail, failFromError } from '../utils/response.js';
import { getPlanSessionWorkflowTrace, getPlanSessionCostSummary } from '../services/plan-workflow-trace.service.js';
import {
  listRecentPlanSessionsForAdmin,
  runAdminSandboxPlan,
} from '../services/plan-admin.service.js';
import { optionalQueryInt } from '../utils/query-coerce.util.js';

const router = Router();

const sandboxRunSchema = z.object({
  prompt: z.string().min(2).max(500),
  days: z.number().int().min(1).max(7).optional(),
  budget: z.string().max(64).optional(),
  provider: z.enum(['auto', 'douxing', 'deepseek', 'lmstudio']).optional(),
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
