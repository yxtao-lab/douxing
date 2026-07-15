import {
  ApiError,
  ApiMessageKey,
  CREDIT_DELTA_DISPUTE,
  CREDIT_DELTA_ORDER_CONFIRMED,
  CertStatus,
} from '@douxing/shared';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { serviceProvider } from '../../db/schema/marketplace-provider.js';

/**
 * 按用户 ID 读取已入驻服务者的当前信用分。
 *
 * @param userId - 服务者用户 ID
 * @returns 信用分；无服务者档案时为 `null`
 */
export async function getProviderCreditScore(userId: number): Promise<number | null> {
  const db = getDb();
  const rows = await db
    .select({ creditScore: serviceProvider.creditScore })
    .from(serviceProvider)
    .where(eq(serviceProvider.userId, userId))
    .limit(1);
  return rows[0]?.creditScore ?? null;
}

/**
 * 对指定服务者信用分施加增量（夹紧到 0～200）。
 *
 * @param userId - 服务者用户 ID
 * @param delta - 增减值（可负）
 * @returns `{ before, after }`；无档案时抛错
 * @throws {ApiError} 服务者不存在
 */
export async function adjustProviderCreditScore(
  userId: number,
  delta: number,
): Promise<{ before: number; after: number }> {
  const db = getDb();
  const rows = await db
    .select()
    .from(serviceProvider)
    .where(eq(serviceProvider.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PROVIDER_NOT_FOUND);
  }

  const before = row.creditScore;
  const after = Math.max(0, Math.min(200, before + delta));
  if (after !== before) {
    await db
      .update(serviceProvider)
      .set({ creditScore: after })
      .where(eq(serviceProvider.id, row.id));
  }
  return { before, after };
}

/**
 * 订单履约确认后为卖方个人服务者加分；无个人卖方时跳过（商户单占位）。
 *
 * @param sellerProviderUserId - 卖方个人用户 ID；商户单为 `null` 时不处理
 * @returns 加分结果；跳过时为 `null`
 */
export async function applyCreditForOrderConfirmed(
  sellerProviderUserId: number | null,
): Promise<{ before: number; after: number } | null> {
  if (sellerProviderUserId == null) {
    return null;
  }
  return adjustProviderCreditScore(sellerProviderUserId, CREDIT_DELTA_ORDER_CONFIRMED);
}

/**
 * 纠纷扣减信用分占位（纠纷表落地后由纠纷结案流程调用）。
 *
 * @param providerUserId - 被扣分服务者用户 ID
 * @returns `{ before, after }`
 * @throws {ApiError} 服务者不存在
 */
export async function applyCreditForDispute(
  providerUserId: number,
): Promise<{ before: number; after: number }> {
  return adjustProviderCreditScore(providerUserId, CREDIT_DELTA_DISPUTE);
}

/**
 * 直接设置服务者信用分（仅验收/运维脚本使用）。
 *
 * @param userId - 服务者用户 ID
 * @param score - 目标分数（0～200）
 * @returns 更新后的分数
 * @throws {ApiError} 服务者不存在或分数非法
 */
export async function setProviderCreditScoreForTest(
  userId: number,
  score: number,
): Promise<number> {
  if (!Number.isFinite(score) || score < 0 || score > 200) {
    throw new ApiError(ApiMessageKey.PARAM_ERROR);
  }
  const db = getDb();
  const rows = await db
    .select({ id: serviceProvider.id })
    .from(serviceProvider)
    .where(and(eq(serviceProvider.userId, userId), eq(serviceProvider.certStatus, CertStatus.APPROVED)))
    .limit(1);
  if (!rows[0]) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PROVIDER_NOT_FOUND);
  }
  await db
    .update(serviceProvider)
    .set({ creditScore: Math.round(score) })
    .where(eq(serviceProvider.id, rows[0].id));
  return Math.round(score);
}
