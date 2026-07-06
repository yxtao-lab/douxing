import { Router, type Response } from 'express';
import { z } from 'zod';
import type { LocaleCode } from '@douxing/shared';
import { ApiMessageKey, ApiError } from '@douxing/shared';
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
import { listRouteComments, createRouteComment, toggleRouteCommentLike, setRouteCommentFeatured } from '../services/route-comment.service.js';
import {
  listRoutePoiExternalLinks,
  createRoutePoiExternalLink,
  deleteRoutePoiExternalLink,
} from '../services/route-poi-external-link.service.js';
import { requirePerm } from '../middleware/admin.middleware.js';
import { getUserWithRoles } from '../services/user.service.js';
import { getAllProvidersStatus, listProviderOptions } from '../services/llm-client.service.js';
import { checkAiServiceStatus } from '../services/ai-service-client.service.js';
import { isLlmEnabled } from '../config/llm.js';
import { buildRouteGenerationMessage } from '../utils/llm-message.util.js';
import { hasPermission } from '../services/permission.service.js';
import { getDb } from '../db/client.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { eq } from 'drizzle-orm';
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
import routeMediaRouter from './route-media.js';

const router = Router();

function getRequestLocale(res: Response): LocaleCode {
  return res.locals.locale ?? 'zh-CN';
}

const providerSchema = z.enum(['auto', 'douxing', 'deepseek', 'lmstudio']).optional();

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
      douxingConfigured: status.douxingConfigured,
      douxingEnabled: status.douxingEnabled,
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
    if (
      req.query.all === '1' &&
      user &&
      hasPermission(user.roles, user.permissions, 'biz:routes:list')
    ) {
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

const commentListQuerySchema = z.object({
  limit: optionalQueryInt(1, 100),
  dayIndex: optionalQueryInt(0, 29),
  attractionId: optionalQueryInt(1, 10_000_000),
  sort: z.enum(['hot', 'recent']).optional(),
});

const poiLinkListQuerySchema = z.object({
  limit: optionalQueryInt(1, 50),
  dayIndex: optionalQueryInt(0, 29),
  attractionId: optionalQueryInt(1, 10_000_000),
  poiName: z.string().min(1).max(128).optional(),
});

const poiLinkSchema = z.object({
  title: z.string().min(1).max(128),
  url: z.string().url().max(512),
  dayIndex: z.number().int().min(0).max(29).optional(),
  attractionId: z.number().int().positive().optional(),
  poiName: z.string().min(1).max(128).optional(),
});

const commentFeaturedSchema = z.object({
  featured: z.boolean(),
});

const commentSchema = z.object({
  content: z.string().min(1).max(500),
  dayIndex: z.number().int().min(0).max(29).optional(),
  attractionId: z.number().int().positive().optional(),
  poiName: z.string().min(1).max(128).optional(),
});

router.use('/:routeId/media', routeMediaRouter);

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
    let route = await getRouteById(routeId, req.auth!.userId, { recordView: false });
    if (!route) {
      const user = await getUserWithRoles(req.auth!.userId);
      const canModerate =
        user != null &&
        hasPermission(user.roles, user.permissions, 'content:attractions:pending');
      if (!canModerate) return fail(res, '路线不存在或无权查看', 404, 404);
      const db = getDb();
      const exists = await db
        .select({ id: travelRoutes.id })
        .from(travelRoutes)
        .where(eq(travelRoutes.id, routeId))
        .limit(1);
      if (!exists[0]) return fail(res, '路线不存在或无权查看', 404, 404);
    }
    const parsed = commentListQuerySchema.safeParse(req.query);
    const limit = parsed.success ? parsed.data.limit : 50;
    const dayIndex = parsed.success ? parsed.data.dayIndex : undefined;
    const attractionId = parsed.success ? parsed.data.attractionId : undefined;
    const sort = parsed.success ? parsed.data.sort : undefined;
    const comments = await listRouteComments(routeId, {
      limit,
      dayIndex,
      attractionId,
      sort,
      viewerUserId: req.auth!.userId,
    });
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
    const comment = await createRouteComment(routeId, req.auth!.userId, parsed.data);
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

router.post('/:id/comments/:commentId/like', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    const commentId = parseInt(String(req.params.commentId), 10);
    if (Number.isNaN(routeId) || Number.isNaN(commentId)) return fail(res, '无效的 ID');
    const result = await toggleRouteCommentLike(routeId, commentId, req.auth!.userId);
    if (!result) return fail(res, ApiMessageKey.ROUTE_COMMENT_NOT_FOUND, 404, 404);
    success(res, result, result.liked ? '已点赞' : '已取消点赞');
  } catch (err) {
    console.error('[routes/comments/like]', err);
    return fail(res, ApiMessageKey.ROUTE_COMMENT_LIKE_FAILED, 500, 500);
  }
});

router.patch('/:id/comments/:commentId/featured', authMiddleware, async (req, res) => {
  if (!(await requirePerm(req, res, 'content:attractions:pending'))) return;
  try {
    const routeId = parseInt(String(req.params.id), 10);
    const commentId = parseInt(String(req.params.commentId), 10);
    if (Number.isNaN(routeId) || Number.isNaN(commentId)) return fail(res, '无效的 ID');
    const parsed = commentFeaturedSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    const comment = await setRouteCommentFeatured(routeId, commentId, parsed.data.featured);
    if (!comment) return fail(res, ApiMessageKey.ROUTE_COMMENT_NOT_FOUND, 404, 404);
    success(res, comment);
  } catch (err) {
    console.error('[routes/comments/featured]', err);
    return fail(res, ApiMessageKey.SERVER_ERROR, 500, 500);
  }
});

router.get('/:id/poi-external-links', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) return fail(res, '无效的路线 ID');
    const parsed = poiLinkListQuerySchema.safeParse(req.query);
    const links = await listRoutePoiExternalLinks(routeId, req.auth!.userId, {
      limit: parsed.success ? parsed.data.limit : undefined,
      dayIndex: parsed.success ? parsed.data.dayIndex : undefined,
      attractionId: parsed.success ? parsed.data.attractionId : undefined,
      poiName: parsed.success ? parsed.data.poiName : undefined,
    });
    if (links === null) return fail(res, ApiMessageKey.ROUTE_FORBIDDEN, 404, 404);
    success(res, links);
  } catch (err) {
    console.error('[routes/poi-external-links GET]', err);
    return fail(res, ApiMessageKey.ROUTE_POI_LINK_LIST_FAILED, 500, 500);
  }
});

router.post('/:id/poi-external-links', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) return fail(res, '无效的路线 ID');
    const parsed = poiLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const link = await createRoutePoiExternalLink(routeId, req.auth!.userId, parsed.data);
    if (!link) return fail(res, ApiMessageKey.ROUTE_POI_LINK_FORBIDDEN, 404, 404);
    success(res, link);
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(res, err.messageKey, 400, 400, err.params);
    }
    console.error('[routes/poi-external-links POST]', err);
    return fail(res, ApiMessageKey.ROUTE_POI_LINK_FAILED, 500, 500);
  }
});

router.delete('/:id/poi-external-links/:linkId', authMiddleware, async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    const linkId = parseInt(String(req.params.linkId), 10);
    if (Number.isNaN(routeId) || Number.isNaN(linkId)) return fail(res, '无效的 ID');
    const ok = await deleteRoutePoiExternalLink(routeId, linkId, req.auth!.userId);
    if (!ok) return fail(res, ApiMessageKey.ROUTE_POI_LINK_NOT_FOUND, 404, 404);
    success(res, { deleted: true });
  } catch (err) {
    console.error('[routes/poi-external-links DELETE]', err);
    return fail(res, ApiMessageKey.ROUTE_POI_LINK_DELETE_FAILED, 500, 500);
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
