import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import {
  createRouteFromPrompt,
  regenerateRouteFromPrompt,
  listUserRoutes,
  getRouteById,
  publishRoute,
  listAllRoutesForAdmin,
} from '../services/route.service.js';
import { getUserWithRoles } from '../services/user.service.js';
import { getAllProvidersStatus, listProviderOptions } from '../services/llm-client.service.js';
import { isLlmEnabled } from '../config/llm.js';
import { RoleCode } from '@douxing/shared';

const router = Router();

const providerSchema = z.enum(['auto', 'deepseek', 'lmstudio']).optional();

const generateSchema = z.object({
  prompt: z.string().min(2, '请描述您的旅行需求'),
  days: z.number().int().min(1).max(7).optional(),
  budget: z.string().optional(),
  provider: providerSchema,
});

router.get('/llm-providers', async (_req, res) => {
  try {
    success(res, {
      options: listProviderOptions(),
    });
  } catch (err) {
    console.error('[routes/llm-providers]', err);
    return fail(res, '获取模型列表失败', 500, 500);
  }
});

router.get('/llm-status', async (_req, res) => {
  try {
    if (!isLlmEnabled()) {
      return success(res, {
        enabled: false,
        message: 'LLM 已在环境变量中禁用',
        providers: [],
      });
    }
    const status = await getAllProvidersStatus();
    const ready = status.providers.find((p) => p.available);
    success(res, {
      enabled: status.enabled,
      available: Boolean(ready),
      model: ready?.model,
      defaultProvider: status.defaultProvider,
      deepseekConfigured: status.deepseekConfigured,
      providers: status.providers,
      error: ready ? undefined : status.providers.map((p) => p.error).filter(Boolean).join('; '),
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
    const { route, generationSource, llmProvider } = await createRouteFromPrompt(
      req.auth!.userId,
      parsed.data,
    );
    let message = '路线已生成（模板模式）';
    if (generationSource === 'llm') {
      message =
        llmProvider === 'deepseek'
          ? '路线已由 DeepSeek 生成'
          : llmProvider === 'lmstudio'
            ? '路线已由本地模型生成'
            : '路线已由 AI 生成';
    }
    success(res, { ...route, generationSource, llmProvider }, message);
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

router.post('/:id/regenerate', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) return fail(res, '无效的路线 ID');
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const result = await regenerateRouteFromPrompt(routeId, req.auth!.userId, parsed.data);
    if (!result) return fail(res, '路线不存在', 404, 404);
    const { route, generationSource, llmProvider } = result;
    let message = '路线已重新生成（模板模式）';
    if (generationSource === 'llm') {
      message =
        llmProvider === 'deepseek'
          ? '路线已由 DeepSeek 重新生成'
          : llmProvider === 'lmstudio'
            ? '路线已由本地模型重新生成'
            : '路线已由 AI 重新生成';
    }
    success(res, { ...route, generationSource, llmProvider }, message);
  } catch (err) {
    if (err instanceof Error && err.message.includes('支持重新生成')) {
      return fail(res, err.message);
    }
    if (err instanceof Error && err.message.includes('已发布')) {
      return fail(res, err.message);
    }
    if (err instanceof Error && err.message.includes('行程节点')) {
      return fail(res, err.message);
    }
    console.error('[routes/regenerate]', err);
    return fail(res, '路线重新生成失败', 500, 500);
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
