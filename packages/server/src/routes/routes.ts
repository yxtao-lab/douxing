import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import {
  createRouteFromPrompt,
  listUserRoutes,
  getRouteById,
  publishRoute,
  listAllRoutesForAdmin,
} from '../services/route.service.js';
import { getUserWithRoles } from '../services/user.service.js';
import { checkLlmAvailability } from '../services/llm-client.service.js';
import { getLlmConfig, isLlmEnabled } from '../config/llm.js';
import { RoleCode } from '@douxing/shared';

const router = Router();

const generateSchema = z.object({
  prompt: z.string().min(2, '请描述您的旅行需求'),
  days: z.number().int().min(1).max(7).optional(),
  budget: z.string().optional(),
});

router.get('/llm-status', async (_req, res) => {
  try {
    const config = getLlmConfig();
    if (!isLlmEnabled()) {
      return success(res, {
        enabled: false,
        available: false,
        baseUrl: config.baseUrl,
        model: config.model,
        message: 'LLM 已在环境变量中禁用',
      });
    }
    const status = await checkLlmAvailability();
    success(res, {
      enabled: true,
      available: status.available,
      baseUrl: config.baseUrl,
      model: status.model ?? config.model,
      error: status.error,
    });
  } catch (err) {
    console.error('[routes/llm-status]', err);
    return fail(res, '检测 LLM 状态失败', 500, 500);
  }
});

router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const { route, generationSource } = await createRouteFromPrompt(
      req.auth!.userId,
      parsed.data,
    );
    const message =
      generationSource === 'llm'
        ? '路线已由 AI 生成'
        : '路线已生成（模板模式，请确认 LM Studio 已启动）';
    success(res, { ...route, generationSource }, message);
  } catch (err) {
    console.error('[routes/generate]', err);
    return fail(res, '路线生成失败', 500, 500);
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await getUserWithRoles(req.auth!.userId);
    if (user?.roles.includes(RoleCode.ADMIN) && req.query.all === '1') {
      const routes = await listAllRoutesForAdmin();
      return success(res, routes);
    }
    const routes = await listUserRoutes(req.auth!.userId);
    success(res, routes);
  } catch (err) {
    console.error('[routes/list]', err);
    return fail(res, '获取路线列表失败', 500, 500);
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) return fail(res, '无效的路线 ID');
    const route = await getRouteById(routeId, req.auth!.userId);
    if (!route) return fail(res, '路线不存在', 404, 404);
    success(res, route);
  } catch (err) {
    console.error('[routes/detail]', err);
    return fail(res, '获取路线详情失败', 500, 500);
  }
});

router.post('/:id/publish', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    const route = await publishRoute(routeId, req.auth!.userId);
    if (!route) return fail(res, '路线不存在', 404, 404);
    success(res, route, '路线已发布');
  } catch (err) {
    console.error('[routes/publish]', err);
    return fail(res, '发布失败', 500, 500);
  }
});

export default router;
