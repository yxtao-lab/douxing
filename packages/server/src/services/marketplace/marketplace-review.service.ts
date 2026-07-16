import { and, desc, eq } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  ServiceOrderReviewTargetType,
  ServiceOrderRevieweeType,
  ServiceOrderRevieweeTypeValue,
  ServiceOrderStatus,
  SERVICE_ORDER_REVIEW_TARGET_TYPES,
  type ServiceOrderReviewCreateInput,
  type ServiceOrderReviewReplyInput,
  type ServiceOrderReviewSummary,
} from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { serviceOrderReview } from '../../db/schema/marketplace-review.js';
import { serviceOrder } from '../../db/schema/marketplace-order.js';
import { users } from '../../db/schema/users.js';
import { bizOrg } from '../../db/schema/marketplace-biz-org.js';
import { getOrderByIdForUser, isUserSellerForOrder } from './marketplace-order.service.js';
import { getOrgRoleForUser } from './marketplace-org-onboard.service.js';

/**
 * 校验评分是否合法（1～5 星）。
 *
 * @param rating - 评分数值
 * @returns 合法为 true
 */
function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

/**
 * 将评价行映射为摘要 DTO。
 *
 * @param row - `service_order_review` 表行
 * @returns 评价摘要
 */
function toReviewSummary(row: typeof serviceOrderReview.$inferSelect): ServiceOrderReviewSummary {
  return {
    id: row.id,
    orderId: row.orderId,
    targetType: row.targetType as ServiceOrderReviewSummary['targetType'],
    fromUserId: row.fromUserId,
    fromNickname: null,
    fromUsername: null,
    toTargetType: row.toTargetType as ServiceOrderReviewSummary['toTargetType'],
    toUserId: row.toUserId ?? null,
    toOrgId: row.toOrgId ?? null,
    toOrgName: null,
    toProviderDisplayName: null,
    rating: row.rating,
    content: row.content ?? null,
    tags: row.tags ?? [],
    replyContent: row.replyContent ?? null,
    replyAt: row.replyAt ? row.replyAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 补全评价摘要中的用户与组织展示名。
 *
 * @param base - 基础评价摘要
 * @returns 补全后的摘要
 */
async function enrichReviewSummary(
  base: ServiceOrderReviewSummary,
): Promise<ServiceOrderReviewSummary> {
  const db = getDb();
  const [fromUserRows, orgRows] = await Promise.all([
    db.select({ nickname: users.nickname, username: users.username }).from(users).where(eq(users.id, base.fromUserId)).limit(1),
    base.toOrgId != null
      ? db.select({ name: bizOrg.name }).from(bizOrg).where(eq(bizOrg.id, base.toOrgId)).limit(1)
      : Promise.resolve([]),
  ]);
  const fromUser = fromUserRows[0];
  const org = orgRows[0];

  let toProviderDisplayName: string | null = null;
  if (base.toUserId != null) {
    const toUserRows = await db
      .select({ nickname: users.nickname, username: users.username })
      .from(users)
      .where(eq(users.id, base.toUserId))
      .limit(1);
    toProviderDisplayName = toUserRows[0]?.nickname ?? toUserRows[0]?.username ?? null;
  }

  return {
    ...base,
    fromNickname: fromUser?.nickname ?? null,
    fromUsername: fromUser?.username ?? null,
    toOrgName: org?.name ?? null,
    toProviderDisplayName,
  };
}

/**
 * 创建履约评价（买/卖双向）。
 *
 * @param orderId - 订单 ID
 * @param userId - 当前评价人用户 ID
 * @param input - 评价内容
 * @returns 新建评价摘要
 * @throws {ApiError} 订单状态非法、无权、重复评价或参数无效
 */
export async function createServiceOrderReview(
  orderId: number,
  userId: number,
  input: ServiceOrderReviewCreateInput,
): Promise<ServiceOrderReviewSummary> {
  if (!SERVICE_ORDER_REVIEW_TARGET_TYPES.includes(input.targetType)) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_REVIEW_INVALID);
  }
  if (!isValidRating(input.rating)) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_REVIEW_INVALID);
  }

  const order = await getOrderByIdForUser(orderId, userId);
  if (order.status !== ServiceOrderStatus.CONFIRMED && order.status !== ServiceOrderStatus.DELIVERED) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_REVIEW_FORBIDDEN);
  }

  const isBuyer = order.buyerUserId === userId;
  const isSeller = await isUserSellerForOrder(
    userId,
    order.sellerOrgId,
    order.sellerProviderUserId,
    order.assignedGuideUserId,
  );

  if (input.targetType === ServiceOrderReviewTargetType.BUYER && !isSeller) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_REVIEW_FORBIDDEN);
  }
  if (input.targetType === ServiceOrderReviewTargetType.SELLER && !isBuyer) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_REVIEW_FORBIDDEN);
  }

  const db = getDb();
  const existing = await db
    .select({ id: serviceOrderReview.id })
    .from(serviceOrderReview)
    .where(and(eq(serviceOrderReview.orderId, orderId), eq(serviceOrderReview.targetType, input.targetType)))
    .limit(1);
  if (existing.length > 0) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_REVIEW_ALREADY_EXISTS);
  }

  let toTargetType: ServiceOrderRevieweeTypeValue;
  let toUserId: number | null = null;
  let toOrgId: number | null = null;
  if (input.targetType === ServiceOrderReviewTargetType.SELLER) {
    // 买方评价卖方：卖方可能是商户或个人服务者
    if (order.sellerOrgId != null) {
      toTargetType = ServiceOrderRevieweeType.ORG;
      toOrgId = order.sellerOrgId;
    } else if (order.sellerProviderUserId != null) {
      toTargetType = ServiceOrderRevieweeType.USER;
      toUserId = order.sellerProviderUserId;
    } else {
      throw new ApiError(ApiMessageKey.MARKETPLACE_REVIEW_FORBIDDEN);
    }
  } else {
    // 卖方评价买方
    toTargetType = ServiceOrderRevieweeType.USER;
    toUserId = order.buyerUserId;
  }

  const [insertResult] = await db.insert(serviceOrderReview).values({
    orderId,
    targetType: input.targetType,
    fromUserId: userId,
    toTargetType,
    toUserId,
    toOrgId,
    rating: input.rating,
    content: input.content?.trim() ?? null,
    tags: input.tags && input.tags.length > 0 ? input.tags : null,
  });

  const reviewId = Number(insertResult.insertId);
  const rows = await db.select().from(serviceOrderReview).where(eq(serviceOrderReview.id, reviewId)).limit(1);
  return enrichReviewSummary(toReviewSummary(rows[0]!));
}

/**
 * 列出订单的全部评价（买/卖双方可读）。
 *
 * @param orderId - 订单 ID
 * @param userId - 当前用户 ID
 * @returns 按创建时间倒序的评价摘要列表
 * @throws {ApiError} 订单不存在或无权
 */
export async function listServiceOrderReviews(
  orderId: number,
  userId: number,
): Promise<ServiceOrderReviewSummary[]> {
  await getOrderByIdForUser(orderId, userId);
  const db = getDb();
  const rows = await db
    .select()
    .from(serviceOrderReview)
    .where(eq(serviceOrderReview.orderId, orderId))
    .orderBy(desc(serviceOrderReview.createdAt));
  const result: ServiceOrderReviewSummary[] = [];
  for (const row of rows) {
    result.push(await enrichReviewSummary(toReviewSummary(row)));
  }
  return result;
}

/**
 * 被评价方回复评价（仅一次）。
 *
 * @param reviewId - 评价 ID
 * @param userId - 回复人用户 ID
 * @param input - 回复内容
 * @returns 更新后的评价摘要
 * @throws {ApiError} 评价不存在、无权或已回复
 */
export async function replyToServiceOrderReview(
  reviewId: number,
  userId: number,
  input: ServiceOrderReviewReplyInput,
): Promise<ServiceOrderReviewSummary> {
  const replyContent = input.replyContent?.trim();
  if (!replyContent || replyContent.length > 2000) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_REVIEW_REPLY_INVALID);
  }

  const db = getDb();
  const rows = await db.select().from(serviceOrderReview).where(eq(serviceOrderReview.id, reviewId)).limit(1);
  const review = rows[0];
  if (!review) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_REVIEW_NOT_FOUND);
  }

  // 校验回复人是否为被评价方（个人服务者或被评价商户成员）
  let canReply = false;
  if (review.toTargetType === ServiceOrderRevieweeType.USER && review.toUserId === userId) {
    canReply = true;
  } else if (review.toTargetType === ServiceOrderRevieweeType.ORG && review.toOrgId != null) {
    const role = await getOrgRoleForUser(userId, review.toOrgId);
    canReply = role != null;
  }
  if (!canReply) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_REVIEW_REPLY_FORBIDDEN);
  }

  if (review.replyContent != null && review.replyContent.trim().length > 0) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_REVIEW_REPLY_INVALID);
  }

  await db
    .update(serviceOrderReview)
    .set({ replyContent, replyAt: new Date() })
    .where(eq(serviceOrderReview.id, reviewId));

  const updated = await db.select().from(serviceOrderReview).where(eq(serviceOrderReview.id, reviewId)).limit(1);
  return enrichReviewSummary(toReviewSummary(updated[0]!));
}
