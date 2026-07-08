import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requirePerm } from '../middleware/admin.middleware.js';
import { success, fail } from '../utils/response.js';
import { ApiMessageKey } from '@douxing/shared';
import { getAgentToolJsonSchemas } from '../services/agent-tool-json-schema.service.js';

const router = Router();
const SchemaPerm = 'data:analytics:view';

router.use(authMiddleware);

/**
 * W6 · 获取 Agent Tool 可编辑入参 JSON Schema（管理端节点表单）。
 * GET /api/admin/agent-tool-schemas
 */
router.get('/', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, SchemaPerm))) return;
    success(res, getAgentToolJsonSchemas());
  } catch (err) {
    console.error('[admin/agent-tool-schemas]', err);
    fail(res, ApiMessageKey.SERVER_ERROR);
  }
});

export default router;
