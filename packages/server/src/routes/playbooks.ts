import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import { getUserWithRoles } from '../services/user.service.js';
import {
  RoleCode,
  ApiMessageKey,
  type RoutePlaybookInfo,
} from '@douxing/shared';
import {
  createRoutePlaybook,
  deleteRoutePlaybook,
  getRoutePlaybookById,
  listRoutePlaybooksForAdmin,
  updateRoutePlaybook,
} from '../services/playbook.service.js';

const router = Router();

const transitModeSchema = z.enum([
  'train',
  'flight',
  'subway',
  'bus',
  'taxi',
  'walk',
  'drive',
]);

const reasonKeySchema = z.enum([
  'classicWalk',
  'scenicWalk',
  'sightseeingBus',
  'ferry',
  'taxiShort',
]);

const segmentSchema = z.object({
  from: z.string().min(1).max(128),
  to: z.string().min(1).max(128),
  mode: transitModeSchema,
  reasonKey: reasonKeySchema,
  fromAliases: z.array(z.string().max(128)).optional(),
  toAliases: z.array(z.string().max(128)).optional(),
});

const playbookBodySchema = z.object({
  id: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'id must be lowercase slug'),
  city: z.string().min(1).max(64),
  scope: z.string().min(1).max(128),
  keywords: z.array(z.string().min(1).max(64)).default([]),
  themes: z.array(z.string().min(1).max(32)).default([]),
  classicOrder: z.array(z.string().min(1).max(128)).min(1),
  segments: z.array(segmentSchema).default([]),
  summaryZh: z.string().min(1).max(2000),
  summaryEn: z.string().min(1).max(2000),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

const playbookUpdateSchema = playbookBodySchema
  .omit({ id: true })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'empty update' });

async function requireAdmin(req: import('express').Request, res: import('express').Response) {
  const user = await getUserWithRoles(req.auth!.userId);
  if (!user?.roles.includes(RoleCode.ADMIN)) {
    fail(res, ApiMessageKey.ADMIN_REQUIRED, 403, 403);
    return null;
  }
  return user;
}

function toApiPlaybook(item: RoutePlaybookInfo): RoutePlaybookInfo {
  return item;
}

router.get('/admin', authMiddleware, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;

  try {
    const city = typeof req.query.city === 'string' ? req.query.city : undefined;
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword : undefined;
    const enabledRaw = req.query.enabled;
    const enabled =
      enabledRaw === 'true' ? true : enabledRaw === 'false' ? false : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : undefined;

    const list = await listRoutePlaybooksForAdmin({ city, keyword, enabled, limit, offset });
    success(res, list.map(toApiPlaybook), ApiMessageKey.PLAYBOOK_LIST_SUCCESS);
  } catch (err) {
    console.error('[playbooks/admin/list]', err);
    fail(res, ApiMessageKey.PLAYBOOK_LIST_FAILED, 500, 500);
  }
});

router.get('/admin/:id', authMiddleware, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;

  const id = String(req.params.id ?? '').trim();
  if (!id) {
    return fail(res, ApiMessageKey.PLAYBOOK_INVALID_ID);
  }

  try {
    const item = await getRoutePlaybookById(id);
    if (!item) {
      return fail(res, ApiMessageKey.PLAYBOOK_NOT_FOUND, 404, 404);
    }
    success(res, toApiPlaybook(item), ApiMessageKey.PLAYBOOK_DETAIL_SUCCESS);
  } catch (err) {
    console.error('[playbooks/admin/detail]', err);
    fail(res, ApiMessageKey.PLAYBOOK_DETAIL_FAILED, 500, 500);
  }
});

router.post('/admin', authMiddleware, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;

  const parsed = playbookBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, ApiMessageKey.PLAYBOOK_VALIDATION_FAILED, 400, 400);
  }

  try {
    const item = await createRoutePlaybook(parsed.data);
    success(res, toApiPlaybook(item), ApiMessageKey.PLAYBOOK_CREATE_SUCCESS);
  } catch (err) {
    if (err instanceof Error && err.message === 'PLAYBOOK_ID_EXISTS') {
      return fail(res, ApiMessageKey.PLAYBOOK_ID_EXISTS, 409, 409);
    }
    console.error('[playbooks/admin/create]', err);
    fail(res, ApiMessageKey.PLAYBOOK_CREATE_FAILED, 500, 500);
  }
});

router.put('/admin/:id', authMiddleware, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;

  const id = String(req.params.id ?? '').trim();
  if (!id) {
    return fail(res, ApiMessageKey.PLAYBOOK_INVALID_ID);
  }

  const parsed = playbookUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, ApiMessageKey.PLAYBOOK_VALIDATION_FAILED, 400, 400);
  }

  try {
    const item = await updateRoutePlaybook(id, parsed.data);
    if (!item) {
      return fail(res, ApiMessageKey.PLAYBOOK_NOT_FOUND, 404, 404);
    }
    success(res, toApiPlaybook(item), ApiMessageKey.PLAYBOOK_UPDATE_SUCCESS);
  } catch (err) {
    console.error('[playbooks/admin/update]', err);
    fail(res, ApiMessageKey.PLAYBOOK_UPDATE_FAILED, 500, 500);
  }
});

router.delete('/admin/:id', authMiddleware, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;

  const id = String(req.params.id ?? '').trim();
  if (!id) {
    return fail(res, ApiMessageKey.PLAYBOOK_INVALID_ID);
  }

  try {
    const deleted = await deleteRoutePlaybook(id);
    if (!deleted) {
      return fail(res, ApiMessageKey.PLAYBOOK_NOT_FOUND, 404, 404);
    }
    success(res, { id }, ApiMessageKey.PLAYBOOK_DELETE_SUCCESS);
  } catch (err) {
    console.error('[playbooks/admin/delete]', err);
    fail(res, ApiMessageKey.PLAYBOOK_DELETE_FAILED, 500, 500);
  }
});

export default router;
