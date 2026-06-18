import { Router, type Response } from 'express';
import { z } from 'zod';
import type { LocaleCode } from '@douxing/shared';
import { ApiMessageKey } from '@douxing/shared';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail, failFromError } from '../utils/response.js';
import {
  createRouteFromPrompt,
  regenerateRouteFromPrompt,
  getRouteById,
  publishRoute,
  listAllRoutesForAdminPaginated,
  updateDraftRoute,
  setRoutePublicShare,
} from '../services/route.service.js';
import {
  buildRouteMapPathFromDetail,
  canAccessRouteMapPath,
  buildRouteMapPathForDay,
} from '../services/route-map-path.service.js';
import {
  listRoutesForUser,
  toggleRouteLike,
  toggleRouteFavorite,
} from '../services/route-interaction.service.js';
import { listRouteComments, createRouteComment } from '../services/route-comment.service.js';
import { getUserWithRoles } from '../services/user.service.js';
import { getAllProvidersStatus, listProviderOptions } from '../services/llm-client.service.js';
import { checkAiServiceStatus } from '../services/ai-service-client.service.js';
import { isLlmEnabled } from '../config/llm.js';
import { buildRouteGenerationMessage } from '../utils/llm-message.util.js';
import { RoleCode } from '@douxing/shared';
import { optionalQueryInt } from '../utils/query-coerce.util.js';
import { parsePaginationQuery } from '../utils/pagination.js';
import {
  parseDateRangeFilter,
  parseOptionalInt,
  parseOptionalString,
} from '../utils/admin-list-filter.js';
import {
  applyRouteReplan,
  previewRouteReplan,
} from '../services/replan-segment.service.js';
import {
  analyzeRouteMissedPois,
  recordMissedPoiRegrets,
} from '../services/missed-poi.service.js';
import planSessionsRouter from './plan-sessions.js';

const router = Router();

function getRequestLocale(res: Response): LocaleCode {
  return res.locals.locale ?? 'zh-CN';
}

const providerSchema = z.enum(['auto', 'deepseek', 'lmstudio']).optional();

const generateSchema = z.object({
  prompt: z.string().min(2, '请描述您的旅行需求'),
  days: z.number().int().min(1).max(7).optional(),
  budget: z.string().optional(),
  provider: providerSchema,
});

const listQuerySchema = z.object({
  scope: z.enum(['mine', 'hot', 'favorites', 'plaza']).optional(),
  status: optionalQueryInt(0, 2),
  sort: z.enum(['recent', 'hot', 'views']).optional(),
  keyword: z.string().max(64).optional(),
  limit: optionalQueryInt(1, 100),
  page: optionalQueryInt(1, 10_000),
  pageSize: optionalQueryInt(1, 100),
});

const updateDraftSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(2000).nullable().optional(),
  budgetRange: z.string().max(64).nullable().optional(),
  days: z.number().int().min(1).max(30).optional(),
  interestTags: z.array(z.string().min(1).max(16)).max(8).optional(),
  routeDetail: z
    .object({
      days: z.array(z.any()),
      isAiGenerated: z.boolean().optional(),
      unlockPrice: z.number().optional(),
      isUnlocked: z.boolean().optional(),
      matchedCity: z.string().optional(),
      generationSource: z.enum(['llm', 'template']).optional(),
      llmProvider: z.string().optional(),
      sourcePrompt: z.string().optional(),
    })
    .optional(),
});

const replanContextSchema = z.object({
  dayIndex: z.number().int().min(0),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  currentTimeMinutes: z.number().int().min(0).max(24 * 60 - 1).optional(),
  visitedPoiNames: z.array(z.string()).optional(),
  remainingPoiNames: z.array(z.string()).optional(),
  gpsLabel: z.string().optional(),
});

const replanBodySchema = z.object({
  context: replanContextSchema,
});

const missedPoiAnalyzeSchema = z.object({
  dayIndex: z.number().int().min(0),
  currentTimeMinutes: z.number().int().min(0).max(24 * 60 - 1).optional(),
  autoRecordRegrets: z.boolean().optional(),
});

const missedPoiRecordSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        dayIndex: z.number().int().min(0),
      }),
    )
    .min(1),
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
    const aiService = await checkAiServiceStatus();
    const ready = status.providers.find((p) => p.available);
    success(res, {
      enabled: status.enabled,
      available: Boolean(ready) || aiService.available,
      model: ready?.model,
      defaultProvider: status.defaultProvider,
      deepseekConfigured: status.deepseekConfigured,
      providers: status.providers,
      aiService,
      error: ready || aiService.available
        ? undefined
        : [status.providers.map((p) => p.error).filter(Boolean).join('; '), aiService.error]
            .filter(Boolean)
            .join('; '),
    });
  } catch (err) {
    console.error('[routes/llm-status]', err);
    return fail(res, '检测 LLM 状态失败', 500, 500);
  }
});

router.use('/plan-sessions', planSessionsRouter);

router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const { route, generationSource, llmProvider } = await createRouteFromPrompt(
      req.auth!.userId,
      { ...parsed.data, locale: getRequestLocale(res) },
    );
    let message = buildRouteGenerationMessage(generationSource, llmProvider);
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
      const { page, pageSize } = parsePaginationQuery(req.query as Record<string, unknown>);
      const query = req.query as Record<string, unknown>;
      const { dateStart, dateEnd } = parseDateRangeFilter(query);
      const result = await listAllRoutesForAdminPaginated(page, pageSize, {
        keyword: parseOptionalString(query, 'keyword'),
        status: parseOptionalInt(query, 'status'),
        creatorId: parseOptionalInt(query, 'creatorId'),
        dateStart,
        dateEnd,
      });
      return success(res, result);
    }
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const result = await listRoutesForUser(req.auth!.userId, parsed.data);
    success(res, result);
  } catch (err) {
    console.error('[routes/list]', err);
    return fail(res, '获取路线列表失败', 500, 500);
  }
});

router.get('/plaza', authMiddleware, async (req, res) => {
  try {
    const parsed = listQuerySchema.safeParse({ ...req.query, scope: 'plaza' });
    const sort = parsed.success ? parsed.data.sort : undefined;
    const page = parsed.success ? parsed.data.page : undefined;
    const pageSize = parsed.success ? parsed.data.pageSize ?? parsed.data.limit : undefined;
    const result = await listRoutesForUser(req.auth!.userId, {
      scope: 'plaza',
      sort: sort ?? 'hot',
      keyword: parsed.success ? parsed.data.keyword : undefined,
      page,
      pageSize,
    });
    success(res, result);
  } catch (err) {
    console.error('[routes/plaza]', err);
    return fail(res, '获取广场路线失败', 500, 500);
  }
});

/** @deprecated 请使用 GET /routes/plaza */
router.get('/hot', authMiddleware, async (req, res) => {
  try {
    const parsed = listQuerySchema.safeParse({ ...req.query, scope: 'plaza' });
    const page = parsed.success ? parsed.data.page : undefined;
    const pageSize = parsed.success ? parsed.data.pageSize ?? parsed.data.limit : undefined;
    const result = await listRoutesForUser(req.auth!.userId, {
      scope: 'plaza',
      sort: 'hot',
      page,
      pageSize,
    });
    success(res, result);
  } catch (err) {
    console.error('[routes/hot]', err);
    return fail(res, '获取热门路线失败', 500, 500);
  }
});

const sharePublicSchema = z.object({
  isPublic: z.boolean(),
});

const commentSchema = z.object({
  content: z.string().min(1, '请输入评论').max(500),
});

router.post('/:id/regenerate', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) return fail(res, '无效的路线 ID');
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const result = await regenerateRouteFromPrompt(routeId, req.auth!.userId, {
      ...parsed.data,
      locale: getRequestLocale(res),
    });
    if (!result) return fail(res, '路线不存在', 404, 404);
    const { route, generationSource, llmProvider } = result;
    const message = buildRouteGenerationMessage(generationSource, llmProvider, true);
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

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) return fail(res, '无效的路线 ID');
    const parsed = updateDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const route = await updateDraftRoute(routeId, req.auth!.userId, parsed.data);
    if (!route) return fail(res, '路线不存在', 404, 404);
    success(res, route, '草稿已保存');
  } catch (err) {
    if (err instanceof Error && err.message.includes('草稿')) {
      return fail(res, err.message);
    }
    console.error('[routes/update]', err);
    return fail(res, '保存草稿失败', 500, 500);
  }
});

router.get('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) return fail(res, '无效的路线 ID');
    const route = await getRouteById(routeId, req.auth!.userId, { recordView: false });
    if (!route) return fail(res, '路线不存在或无权查看', 404, 404);
    const parsed = listQuerySchema.safeParse(req.query);
    const limit = parsed.success ? parsed.data.limit : 50;
    const comments = await listRouteComments(routeId, limit);
    success(res, comments);
  } catch (err) {
    console.error('[routes/comments GET]', err);
    return fail(res, '获取评论失败', 500, 500);
  }
});

router.post('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) return fail(res, '无效的路线 ID');
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const comment = await createRouteComment(routeId, req.auth!.userId, parsed.data.content);
    if (!comment) return fail(res, '仅广场公开路线可评论', 404, 404);
    success(res, comment, '评论成功');
  } catch (err) {
    if (err instanceof Error && err.message.includes('评论')) {
      return fail(res, err.message);
    }
    console.error('[routes/comments POST]', err);
    return fail(res, '发表评论失败', 500, 500);
  }
});

router.post('/:id/share', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) return fail(res, '无效的路线 ID');
    const parsed = sharePublicSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const route = await setRoutePublicShare(routeId, req.auth!.userId, parsed.data.isPublic);
    if (!route) return fail(res, '路线不存在', 404, 404);
    success(res, route, parsed.data.isPublic ? '已公开到广场' : '已取消公开');
  } catch (err) {
    if (err instanceof Error && err.message.includes('发布')) {
      return fail(res, err.message);
    }
    console.error('[routes/share]', err);
    return fail(res, '设置公开分享失败', 500, 500);
  }
});

router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) return fail(res, '无效的路线 ID');
    const result = await toggleRouteLike(routeId, req.auth!.userId);
    if (!result) return fail(res, '路线未公开或不存在', 404, 404);
    success(res, result, result.liked ? '已点赞' : '已取消点赞');
  } catch (err) {
    console.error('[routes/like]', err);
    return fail(res, '点赞操作失败', 500, 500);
  }
});

router.post('/:id/favorite', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) return fail(res, '无效的路线 ID');
    const result = await toggleRouteFavorite(routeId, req.auth!.userId);
    if (!result) return fail(res, '路线未公开或不存在', 404, 404);
    success(res, result, result.favorited ? '已收藏' : '已取消收藏');
  } catch (err) {
    console.error('[routes/favorite]', err);
    return fail(res, '收藏操作失败', 500, 500);
  }
});

router.get('/:id/map-path', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) {
      return fail(res, ApiMessageKey.INVALID_ROUTE_ID);
    }

    const route = await getRouteById(routeId, req.auth!.userId, { recordView: false });
    if (!route) return fail(res, ApiMessageKey.ROUTE_NOT_FOUND, 404, 404);
    if (!canAccessRouteMapPath(route, req.auth!.userId)) {
      return fail(res, ApiMessageKey.ROUTE_MAP_PATH_FORBIDDEN, 403, 403);
    }

    const dayRaw = req.query.day;
    const pathOptions = { routeId: route.id, name: route.name };
    let mapPath: Awaited<ReturnType<typeof buildRouteMapPathFromDetail>>;

    if (dayRaw !== undefined && dayRaw !== '') {
      const dayIndex = parseInt(String(dayRaw), 10);
      if (Number.isNaN(dayIndex) || dayIndex < 0) {
        return fail(res, ApiMessageKey.INVALID_ROUTE_ID);
      }
      mapPath = await buildRouteMapPathForDay(route.routeDetail, dayIndex, pathOptions);
    } else {
      mapPath = await buildRouteMapPathFromDetail(route.routeDetail, pathOptions);
    }
    if (!mapPath) {
      return fail(res, ApiMessageKey.ROUTE_MAP_PATH_EMPTY, 404, 404);
    }

    success(res, mapPath);
  } catch (err) {
    console.error('[routes/map-path]', err);
    return fail(res, ApiMessageKey.ROUTE_MAP_PATH_FAILED, 500, 500);
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

router.post('/:id/replan/preview', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) {
      return fail(res, ApiMessageKey.INVALID_ROUTE_ID);
    }
    const parsed = replanBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, ApiMessageKey.VALIDATION_ERROR, 1, 400);
    }

    const locale = getRequestLocale(res);
    const result = await previewRouteReplan({
      routeId,
      userId: req.auth!.userId,
      locale,
      context: parsed.data.context,
    });
    success(res, result);
  } catch (err) {
    console.error('[routes/replan/preview]', err);
    return failFromError(res, err);
  }
});

router.post('/:id/replan/apply', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) {
      return fail(res, ApiMessageKey.INVALID_ROUTE_ID);
    }
    const parsed = replanBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, ApiMessageKey.VALIDATION_ERROR, 1, 400);
    }

    const locale = getRequestLocale(res);
    const route = await applyRouteReplan({
      routeId,
      userId: req.auth!.userId,
      locale,
      context: parsed.data.context,
    });
    success(res, route);
  } catch (err) {
    console.error('[routes/replan/apply]', err);
    return failFromError(res, err);
  }
});

router.post('/:id/missed-pois/analyze', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) {
      return fail(res, ApiMessageKey.INVALID_ROUTE_ID);
    }
    const parsed = missedPoiAnalyzeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, ApiMessageKey.VALIDATION_ERROR, 1, 400);
    }

    const locale = getRequestLocale(res);
    const result = await analyzeRouteMissedPois({
      routeId,
      userId: req.auth!.userId,
      locale,
      dayIndex: parsed.data.dayIndex,
      currentTimeMinutes: parsed.data.currentTimeMinutes,
      autoRecordRegrets: parsed.data.autoRecordRegrets,
    });
    success(res, result);
  } catch (err) {
    console.error('[routes/missed-pois/analyze]', err);
    return failFromError(res, err);
  }
});

router.post('/:id/missed-pois/record', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) {
      return fail(res, ApiMessageKey.INVALID_ROUTE_ID);
    }
    const parsed = missedPoiRecordSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, ApiMessageKey.VALIDATION_ERROR, 1, 400);
    }

    const locale = getRequestLocale(res);
    const result = await recordMissedPoiRegrets({
      routeId,
      userId: req.auth!.userId,
      locale,
      items: parsed.data.items,
    });
    success(res, result);
  } catch (err) {
    console.error('[routes/missed-pois/record]', err);
    return failFromError(res, err);
  }
});

export default router;
