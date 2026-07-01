import { Router, type Request, type Response } from 'express';
import { API_PREFIX } from '@douxing/shared';
import { verifyAgentToolAuth } from '../config/agent.js';
import { AGENT_TOOL_NAMES, executeAgentTool, type ToolName } from '../agent/tools/index.js';
import { fail, success } from '../utils/response.js';
import { ApiMessageKey } from '@douxing/shared';

const router = Router();

function agentToolAuth(req: Request, res: Response, next: () => void) {
  const header = req.headers['x-agent-tool-secret'];
  const value = typeof header === 'string' ? header : header?.[0];
  if (!verifyAgentToolAuth(value)) {
    fail(res, ApiMessageKey.FORBIDDEN, 403);
    return;
  }
  next();
}

router.use(agentToolAuth);

router.get('/', (_req, res) => {
  success(res, { tools: AGENT_TOOL_NAMES });
});

router.post('/:name', async (req, res) => {
  const name = req.params.name as ToolName;
  if (!AGENT_TOOL_NAMES.includes(name)) {
    fail(res, ApiMessageKey.NOT_FOUND, 404);
    return;
  }

  try {
    const result = await executeAgentTool(name, req.body ?? {});
    if (!result.ok) {
      fail(res, result.error?.message ?? ApiMessageKey.VALIDATION_ERROR, 1, 400);
      return;
    }
    success(res, result.data);
  } catch (err) {
    console.error('[agent-tools]', name, err);
    fail(res, ApiMessageKey.SERVER_ERROR, 1, 500);
  }
});

export default router;
export const agentToolsMountPath = `${API_PREFIX}/agent/tools`;
