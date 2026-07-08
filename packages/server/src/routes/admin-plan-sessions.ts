import { Router } from 'express';
import { API_PREFIX, ApiMessageKey } from '@douxing/shared';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.middleware.js';
import { success, fail } from '../utils/response.js';
import { getPlanSessionWorkflowTrace } from '../services/plan-workflow-trace.service.js';

const router = Router();

router.use(authMiddleware);

/**
 * W0-5：规划诊断 trace（只读，管理员）。
 * GET /api/admin/plan-sessions/:sessionId/workflow-trace
 */
router.get('/:sessionId/workflow-trace', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

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

export default router;
export const adminPlanSessionsMountPath = `${API_PREFIX}/admin/plan-sessions`;
