import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import { parsePaginationQuery } from '../utils/pagination.js';
import {
  listMembershipProducts,
  getMembershipInfoForUser,
  listUserMembershipLogsPaginated,
} from '../services/membership.service.js';
import { createMembershipUpgradeOrder } from '../services/order.service.js';
import { ApiMessageKey, isApiMessageKey } from '@douxing/shared';

const router = Router();

router.get('/products', authMiddleware, async (_req, res) => {
  try {
    success(res, listMembershipProducts());
  } catch (err) {
    console.error('[membership/products]', err);
    return fail(res, ApiMessageKey.SERVER_ERROR, 500, 500);
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const membership = await getMembershipInfoForUser(req.auth!.userId);
    if (!membership) {
      return fail(res, ApiMessageKey.USER_NOT_FOUND, 404, 404);
    }
    success(res, membership);
  } catch (err) {
    console.error('[membership/me]', err);
    return fail(res, ApiMessageKey.MEMBERSHIP_FETCH_FAILED, 500, 500);
  }
});

router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const { page, pageSize } = parsePaginationQuery(req.query as Record<string, unknown>);
    const result = await listUserMembershipLogsPaginated(req.auth!.userId, page, pageSize);
    success(res, result);
  } catch (err) {
    console.error('[membership/logs]', err);
    return fail(res, ApiMessageKey.MEMBERSHIP_LOG_LIST_FAILED, 500, 500);
  }
});

const createOrderSchema = z.object({
  targetLevel: z.number().int().min(1).max(3),
});

router.post('/orders', authMiddleware, async (req, res) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, ApiMessageKey.PARAM_ERROR);
    const result = await createMembershipUpgradeOrder(req.auth!.userId, parsed.data.targetLevel);
    if ('error' in result) {
      const errKey = result.error;
      if (errKey && isApiMessageKey(errKey)) return fail(res, errKey);
      return fail(res, errKey ?? ApiMessageKey.MEMBERSHIP_ORDER_CREATE_FAILED);
    }
    success(res, result.order, ApiMessageKey.MEMBERSHIP_ORDER_CREATED);
  } catch (err) {
    console.error('[membership/orders/create]', err);
    return fail(res, ApiMessageKey.MEMBERSHIP_ORDER_CREATE_FAILED, 500, 500);
  }
});

export default router;
