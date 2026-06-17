import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { verifyAgentToolAuth } from '../config/agent.js';
import { routeAgentIntent } from '../services/agent-intent-router.service.js';
import { fail, success } from '../utils/response.js';
import { ApiMessageKey } from '@douxing/shared';

const router = Router();

const routeIntentBodySchema = z.object({
  message: z.string(),
});

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

/** ai-service graph 与 Node 共用同一套追问意图规则 */
router.post('/', (req, res) => {
  const parsed = routeIntentBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    fail(res, ApiMessageKey.VALIDATION_ERROR, 1, 400);
    return;
  }

  const routed = routeAgentIntent(parsed.data.message);
  success(res, routed);
});

export default router;
