import { Router } from 'express';
import { z } from 'zod';
import {
  ApiMessageKey,
  sceneTagPresets,
  formatSceneTagLabel,
  isSceneTagSlug,
  type SceneTagSlug,
} from '@douxing/shared';
import { success, fail } from '../utils/response.js';
import { listHotAttractionsForScene } from '../services/scene-detail.service.js';
import { listRoutesForUser } from '../services/route-interaction.service.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';

const router = Router();

const listQuerySchema = z.object({
  /** 景点数量上限 */
  attractionLimit: z.coerce.number().int().min(1).max(50).optional(),
  /** 路线数量上限 */
  routeLimit: z.coerce.number().int().min(1).max(50).optional(),
  /** 路线页码 */
  page: z.coerce.number().int().min(1).optional(),
  /** 路线每页条数 */
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * 返回所有场景标签预设（slug + 当前语言展示文案）。
 *
 * 供前端首页 chip 行与专题页头部渲染。
 */
router.get('/tags', (req, res) => {
  const locale = res.locals.locale ?? 'zh-CN';
  const tags = sceneTagPresets.map((slug) => ({
    slug,
    label: formatSceneTagLabel(slug, locale),
  }));
  success(res, { tags });
});

/**
 * 返回指定场景的聚合页数据：场景元信息 + 景点列表 + 公开路线列表。
 *
 * @param slug - 场景标签 slug（URL 段）
 * @returns { scene, attractions, routes }
 */
router.get('/:slug', optionalAuthMiddleware, async (req, res) => {
  try {
    const slug = String(req.params.slug);
    if (!isSceneTagSlug(slug)) {
      return fail(res, ApiMessageKey.PARAM_ERROR, 1, 400);
    }
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? ApiMessageKey.PARAM_ERROR, 1, 400);
    }
    const locale = res.locals.locale ?? 'zh-CN';
    const sceneSlug = slug as SceneTagSlug;
    const attractionLimit = parsed.data.attractionLimit ?? 10;
    const routePageSize = parsed.data.pageSize ?? parsed.data.routeLimit ?? 12;
    const routePage = parsed.data.page ?? 1;

    // 优先库内 sceneTags；不足则从该场景公开路线 POI 热度补齐
    const attractions = await listHotAttractionsForScene(sceneSlug, attractionLimit);

    const routesResult = await listRoutesForUser(req.auth?.userId ?? 0, {
      scope: 'plaza',
      sort: 'hot',
      sceneTags: [sceneSlug],
      page: routePage,
      pageSize: routePageSize,
    });

    success(res, {
      scene: {
        slug: sceneSlug,
        label: formatSceneTagLabel(sceneSlug, locale),
      },
      attractions,
      routes: routesResult,
    });
  } catch (err) {
    console.error('[scenes/detail]', err);
    return fail(res, ApiMessageKey.SERVER_ERROR, 500, 500);
  }
});

export default router;
