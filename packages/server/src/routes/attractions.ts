import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import { getUserWithRoles } from '../services/user.service.js';
import { RoleCode } from '@douxing/shared';
import {
  listAttractions,
  getAttractionById,
  listCitiesWithAttractions,
  listPendingAttractions,
  approveAttraction,
} from '../services/attraction.service.js';

const router = Router();

async function requireAdmin(req: import('express').Request, res: import('express').Response) {
  const user = await getUserWithRoles(req.auth!.userId);
  if (!user?.roles.includes(RoleCode.ADMIN)) {
    fail(res, '需要管理员权限', 403, 403);
    return null;
  }
  return user;
}

const listQuerySchema = z.object({
  city: z.string().max(64).optional(),
  cityCode: z.string().max(32).optional(),
  keyword: z.string().max(64).optional(),
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const arr = Array.isArray(v) ? v : v.split(',');
      return arr.map((t) => t.trim()).filter(Boolean);
    }),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

router.get('/admin/pending', authMiddleware, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const list = await listPendingAttractions(Number.isNaN(limit) ? 50 : limit);
    success(res, list);
  } catch (err) {
    console.error('[attractions/admin/pending]', err);
    return fail(res, '获取待审核景点失败', 500, 500);
  }
});

router.post('/admin/:id/approve', authMiddleware, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id) || id <= 0) {
      return fail(res, '无效的景点 ID');
    }
    const item = await approveAttraction(id);
    if (!item) {
      return fail(res, '景点不存在', 404, 404);
    }
    success(res, item, '已通过审核');
  } catch (err) {
    const message = err instanceof Error ? err.message : '审核失败';
    return fail(res, message);
  }
});

router.get('/cities', async (_req, res) => {
  try {
    const cities = await listCitiesWithAttractions();
    success(res, cities);
  } catch (err) {
    console.error('[attractions/cities]', err);
    return fail(res, '获取城市列表失败', 500, 500);
  }
});

router.get('/', async (req, res) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const list = await listAttractions(parsed.data);
    success(res, list);
  } catch (err) {
    console.error('[attractions/list]', err);
    return fail(res, '获取景点列表失败', 500, 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id) || id <= 0) {
      return fail(res, '无效的景点 ID');
    }
    const item = await getAttractionById(id);
    if (!item) {
      return fail(res, '景点不存在', 404, 404);
    }
    success(res, item);
  } catch (err) {
    console.error('[attractions/detail]', err);
    return fail(res, '获取景点详情失败', 500, 500);
  }
});

export default router;
