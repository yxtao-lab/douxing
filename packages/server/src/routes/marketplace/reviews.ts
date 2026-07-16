import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.js';
import { fail, failFromError, success } from '../../utils/response.js';
import { ApiMessageKey, ServiceOrderReviewTargetType } from '@douxing/shared';
import {
  createServiceOrderReview,
  listServiceOrderReviews,
  replyToServiceOrderReview,
} from '../../services/marketplace/marketplace-review.service.js';

const router = Router({ mergeParams: true });

const reviewSchema = z.object({
  targetType: z.enum([ServiceOrderReviewTargetType.BUYER, ServiceOrderReviewTargetType.SELLER]),
  rating: z.number().int().min(1).max(5),
  content: z.string().max(2000).optional(),
  tags: z.array(z.string().max(32)).max(10).optional(),
});

const replySchema = z.object({
  replyContent: z.string().min(1).max(2000),
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

/**
 * 解析评价 ID。
 *
 * @param raw - 路由参数原始字符串
 * @returns 正整数 ID；非法时 `null`
 */
function parseReviewId(raw: string): number | null {
  const id = parseInt(raw, 10);
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
    const items = await listServiceOrderReviews(orderId, req.auth!.userId);
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

  const parsed = reviewSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_REVIEW_INVALID, 400, 400);
    return;
  }

  try {
    const review = await createServiceOrderReview(orderId, req.auth!.userId, parsed.data);
    success(res, review);
  } catch (err) {
    failFromError(res, err);
  }
});

router.post('/:reviewId/reply', authMiddleware, async (req, res) => {
  const orderId = parseOrderId(req);
  if (!orderId) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }
  const reviewId = parseReviewId(Array.isArray(req.params.reviewId) ? req.params.reviewId[0] ?? '' : req.params.reviewId ?? '');
  if (!reviewId) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  const parsed = replySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_REVIEW_REPLY_INVALID, 400, 400);
    return;
  }

  try {
    const review = await replyToServiceOrderReview(reviewId, req.auth!.userId, parsed.data);
    success(res, review);
  } catch (err) {
    failFromError(res, err);
  }
});

export default router;
