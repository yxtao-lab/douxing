import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import {
  appendPlanSessionMessage,
  createPlanSession,
  getPlanSessionDetail,
  listPlanSessions,
} from '../services/plan-session.service.js';
import { optionalQueryInt } from '../utils/query-coerce.util.js';

const router = Router();

const providerSchema = z.enum(['auto', 'deepseek', 'lmstudio']).optional();

const createSessionSchema = z.object({
  prompt: z.string().min(2, '请描述您的旅行需求'),
  days: z.number().int().min(1).max(7).optional(),
  budget: z.string().optional(),
  provider: providerSchema,
});

const appendMessageSchema = z.object({
  content: z.string().min(1, '请输入追问或修改意见').max(500),
});

const listQuerySchema = z.object({
  limit: optionalQueryInt(1, 50),
});

function buildGenerationMessage(
  generationSource?: 'llm' | 'template',
  llmProvider?: string,
  isFollowUp = false,
): string {
  const prefix = isFollowUp ? '路线已更新' : '路线已生成';
  if (generationSource !== 'llm') {
    return `${prefix}（模板模式）`;
  }
  if (llmProvider === 'deepseek') return `${prefix}（DeepSeek）`;
  if (llmProvider === 'lmstudio') return `${prefix}（本地模型）`;
  return `${prefix}（AI）`;
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    const limit = parsed.success ? parsed.data.limit : 20;
    const sessions = await listPlanSessions(req.auth!.userId, limit);
    success(res, sessions);
  } catch (err) {
    console.error('[plan-sessions/list]', err);
    return fail(res, '获取规划会话失败', 500, 500);
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const result = await createPlanSession(req.auth!.userId, parsed.data);
    const message = buildGenerationMessage(result.generationSource, result.llmProvider);
    success(res, result, message);
  } catch (err) {
    console.error('[plan-sessions/create]', err);
    return fail(res, '创建规划会话失败', 500, 500);
  }
});

router.get('/:sessionId', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(String(req.params.sessionId), 10);
    if (Number.isNaN(sessionId)) return fail(res, '无效的会话 ID');
    const session = await getPlanSessionDetail(sessionId, req.auth!.userId);
    if (!session) return fail(res, '会话不存在', 404, 404);
    success(res, session);
  } catch (err) {
    console.error('[plan-sessions/detail]', err);
    return fail(res, '获取会话详情失败', 500, 500);
  }
});

router.post('/:sessionId/messages', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(String(req.params.sessionId), 10);
    if (Number.isNaN(sessionId)) return fail(res, '无效的会话 ID');
    const parsed = appendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const result = await appendPlanSessionMessage(
      sessionId,
      req.auth!.userId,
      parsed.data.content,
    );
    if (!result) return fail(res, '会话不存在', 404, 404);
    const message = buildGenerationMessage(result.generationSource, result.llmProvider, true);
    success(res, result, message);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('会话') || err.message.includes('请输入')) {
        return fail(res, err.message);
      }
      if (err.message.includes('支持重新生成') || err.message.includes('已发布')) {
        return fail(res, err.message);
      }
    }
    console.error('[plan-sessions/messages]', err);
    return fail(res, '更新规划方案失败', 500, 500);
  }
});

export default router;
