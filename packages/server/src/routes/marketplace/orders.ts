import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.js';
import { fail, failFromError, success } from '../../utils/response.js';
import { ApiMessageKey, ServiceOrderStatus } from '@douxing/shared';
import {
  advanceServiceOrderStatus,
  getOrderByIdForUser,
  listServiceOrdersByBuyer,
  payMockServiceOrder,
} from '../../services/marketplace/marketplace-order.service.js';

const router = Router();

const statusSchema = z.object({
  status: z.enum([
    ServiceOrderStatus.IN_PROGRESS,
    ServiceOrderStatus.DELIVERED,
    ServiceOrderStatus.CONFIRMED,
  ]),
});

/**
 * 解析路径中的订单 ID。
 *
 * @param raw - 路由参数原始字符串
 * @returns 正整数 ID；非法时 `null`
 */
function parseOrderId(raw: string): number | null {
  const id = parseInt(raw, 10);
  if (Number.isNaN(id) || id <= 0) return null;
  return id;
}

router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const items = await listServiceOrdersByBuyer(req.auth!.userId);
    success(res, { items });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseOrderId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  try {
    const order = await getOrderByIdForUser(id, req.auth!.userId);
    success(res, order);
  } catch (err) {
    failFromError(res, err);
  }
});

router.post('/:id/pay-mock', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseOrderId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  try {
    const order = await payMockServiceOrder(id, req.auth!.userId);
    success(res, order);
  } catch (err) {
    failFromError(res, err);
  }
});

router.patch('/:id/status', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseOrderId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_ORDER_STATUS_INVALID, 400, 400);
    return;
  }

  try {
    const order = await advanceServiceOrderStatus(id, req.auth!.userId, parsed.data);
    success(res, order);
  } catch (err) {
    failFromError(res, err);
  }
});

export default router;
