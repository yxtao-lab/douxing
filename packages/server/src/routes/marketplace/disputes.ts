import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.js';
import { fail, failFromError, success } from '../../utils/response.js';
import {
  ApiMessageKey,
  ServiceOrderDisputeType,
  SERVICE_ORDER_DISPUTE_TYPES,
} from '@douxing/shared';
import {
  createServiceOrderDispute,
  listServiceOrderDisputes,
} from '../../services/marketplace/marketplace-dispute.service.js';

const router = Router({ mergeParams: true });

const disputeSchema = z.object({
  type: z.enum([
    ServiceOrderDisputeType.QUALITY,
    ServiceOrderDisputeType.NO_SHOW,
    ServiceOrderDisputeType.SCHEDULE,
    ServiceOrderDisputeType.SAFETY,
    ServiceOrderDisputeType.OTHER,
  ]),
  reason: z.string().min(1).max(4000),
});

/**
 * 解析订单 ID（来自父路由参数）。
 *
 * @param req - Express 请求
 * @returns 正整数 ID；非法时 `null`
 */
function parseOrderId(req: import('express').Request): number | null {
  const raw = req.params.id;
  const id = parseInt(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '', 10);
  if (Number.isNaN(id) || id <= 0) return null;
  return id;
}

router.get('/', authMiddleware, async (req, res) => {
  const orderId = parseOrderId(req);
  if (!orderId) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  try {
    const items = await listServiceOrderDisputes(orderId, req.auth!.userId);
    success(res, { items });
  } catch (err) {
    failFromError(res, err);
  }
});

router.post('/', authMiddleware, async (req, res) => {
  const orderId = parseOrderId(req);
  if (!orderId) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  const parsed = disputeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_DISPUTE_INVALID, 400, 400);
    return;
  }

  try {
    const dispute = await createServiceOrderDispute(orderId, req.auth!.userId, parsed.data);
    success(res, dispute);
  } catch (err) {
    failFromError(res, err);
  }
});

export default router;
