import { desc, eq } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  MemberLevel,
  MembershipChangeSource,
  POINT_REDEMPTION_CATALOG,
  PointRedemptionProductId,
  buildVerificationPointDedupeKey,
  estimatePhotoPackOwned,
  getPhotoQuotaByMemberLevel,
  getPlanCandidateCountByMemberLevel,
  getPointRedemptionProduct,
  isPointRedemptionProductId,
  resolveSpendEventTypeForProduct,
  type PointRedemptionCatalogItem,
  type PointRedemptionEntitlements,
  type PointRedemptionRecord,
  type PointRedemptionResult,
  type PointRedemptionProduct,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { pointRedemptions } from '../db/schema/point-redemptions.js';
import { formatDbDateTimeForApi } from '../utils/api-datetime.js';
import {
  applyMembershipUpgrade,
  getUserMemberLevel,
} from './membership.service.js';
import {
  debitVerificationPoints,
  getVerificationPointsBalance,
} from './verification-points.service.js';

/**
 * 读取用户兑换权益字段。
 *
 * @param userId - 用户 ID
 * @returns 权益行；用户不存在则为 null
 */
async function loadUserEntitlementRow(userId: number) {
  const db = getDb();
  const rows = await db
    .select({
      verificationPoints: users.verificationPoints,
      bonusPlanCandidates: users.bonusPlanCandidates,
      bonusPhotoCount: users.bonusPhotoCount,
      bonusPhotoBytes: users.bonusPhotoBytes,
      posterStickerUnlocked: users.posterStickerUnlocked,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 组装权益快照（含有效规划候选与相册上限）。
 *
 * @param userId - 用户 ID
 * @returns 权益快照
 * @throws {ApiError} 用户不存在
 */
export async function getPointRedemptionEntitlements(
  userId: number,
): Promise<PointRedemptionEntitlements> {
  const row = await loadUserEntitlementRow(userId);
  if (!row) throw new ApiError(ApiMessageKey.USER_NOT_FOUND);

  const level = await getUserMemberLevel(userId);
  const baseQuota = getPhotoQuotaByMemberLevel(level);
  const bonusPlan = Number(row.bonusPlanCandidates ?? 0);
  const bonusPhotoCount = Number(row.bonusPhotoCount ?? 0);
  const bonusPhotoBytes = Number(row.bonusPhotoBytes ?? 0);

  return {
    balance: Number(row.verificationPoints ?? 0),
    bonusPlanCandidates: bonusPlan,
    bonusPhotoCount,
    bonusPhotoBytes,
    posterStickerUnlocked: row.posterStickerUnlocked === 1,
    effectivePlanCandidates: getPlanCandidateCountByMemberLevel(level) + bonusPlan,
    effectivePhotoMaxCount: baseQuota.maxCount + bonusPhotoCount,
    effectivePhotoMaxBytes: baseQuota.maxBytes + bonusPhotoBytes,
  };
}

/**
 * 统计某商品已拥有数量（用于上限判断）。
 *
 * @param product - 商品
 * @param entitlements - 当前权益
 * @returns ownedCount
 */
function resolveOwnedCount(
  product: PointRedemptionProduct,
  entitlements: PointRedemptionEntitlements,
): number {
  switch (product.id) {
    case PointRedemptionProductId.AI_PLAN_PACK:
      return entitlements.bonusPlanCandidates;
    case PointRedemptionProductId.PHOTO_QUOTA_PACK:
      return estimatePhotoPackOwned(
        entitlements.bonusPhotoCount,
        product.grantPhotoCount ?? 100,
      );
    case PointRedemptionProductId.POSTER_STICKER:
      return entitlements.posterStickerUnlocked ? 1 : 0;
    case PointRedemptionProductId.MEMBER_TRIAL_SILVER:
      return 0;
    default:
      return 0;
  }
}

/**
 * 评估商品是否可兑及阻断原因。
 *
 * @param product - 商品
 * @param entitlements - 权益
 * @param memberLevel - 当前有效会员等级
 * @returns canRedeem + reason
 */
function evaluateRedeemability(
  product: PointRedemptionProduct,
  entitlements: PointRedemptionEntitlements,
  memberLevel: number,
): { canRedeem: boolean; blockedReason: string | null; ownedCount: number } {
  const ownedCount = resolveOwnedCount(product, entitlements);

  if (entitlements.balance < product.costPoints) {
    return { canRedeem: false, blockedReason: 'insufficient', ownedCount };
  }

  if (product.id === PointRedemptionProductId.POSTER_STICKER && ownedCount > 0) {
    return { canRedeem: false, blockedReason: 'already_owned', ownedCount };
  }

  if (
    product.maxOwned != null &&
    ownedCount >= product.maxOwned &&
    product.id !== PointRedemptionProductId.MEMBER_TRIAL_SILVER
  ) {
    return { canRedeem: false, blockedReason: 'limit', ownedCount };
  }

  if (product.id === PointRedemptionProductId.MEMBER_TRIAL_SILVER) {
    if (memberLevel >= MemberLevel.SILVER) {
      return { canRedeem: false, blockedReason: 'member_not_eligible', ownedCount };
    }
  }

  return { canRedeem: true, blockedReason: null, ownedCount };
}

/**
 * 列出兑换目录（含可兑状态）。
 *
 * @param userId - 用户 ID
 * @returns 目录项
 */
export async function listPointRedemptionCatalog(
  userId: number,
): Promise<PointRedemptionCatalogItem[]> {
  const entitlements = await getPointRedemptionEntitlements(userId);
  const memberLevel = await getUserMemberLevel(userId);

  return POINT_REDEMPTION_CATALOG.map((product) => {
    const { canRedeem, blockedReason, ownedCount } = evaluateRedeemability(
      product,
      entitlements,
      memberLevel,
    );
    return {
      id: product.id,
      costPoints: product.costPoints,
      grantPlanCandidates: product.grantPlanCandidates,
      grantPhotoCount: product.grantPhotoCount,
      grantPhotoBytes: product.grantPhotoBytes,
      grantMemberLevel: product.grantMemberLevel,
      grantMemberDays: product.grantMemberDays,
      grantPosterSticker: product.grantPosterSticker,
      maxOwned: product.maxOwned,
      ownedCount,
      canRedeem,
      blockedReason,
    };
  });
}

/**
 * 分页列出兑换记录。
 *
 * @param userId - 用户
 * @param limit - 条数
 * @returns 记录列表
 */
export async function listPointRedemptions(
  userId: number,
  limit = 20,
): Promise<PointRedemptionRecord[]> {
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit) || 20));
  const db = getDb();
  const rows = await db
    .select()
    .from(pointRedemptions)
    .where(eq(pointRedemptions.userId, userId))
    .orderBy(desc(pointRedemptions.createdAt), desc(pointRedemptions.id))
    .limit(safeLimit);
  return rows.map((row) => ({
    id: Number(row.id),
    productId: row.productId,
    pointsSpent: row.pointsSpent,
    createdAt: formatDbDateTimeForApi(row.createdAt),
  }));
}

/**
 * 执行兑换：扣积分 → 发放权益 → 写兑换记录。
 *
 * @param userId - 用户
 * @param productId - 商品 ID
 * @param clientRequestId - 可选幂等键
 * @returns 兑换结果
 * @throws {ApiError} 商品非法、余额不足、达上限等
 */
export async function redeemPointsProduct(
  userId: number,
  productId: string,
  clientRequestId?: string | null,
): Promise<PointRedemptionResult> {
  if (!isPointRedemptionProductId(productId)) {
    throw new ApiError(ApiMessageKey.POINTS_REDEMPTION_PRODUCT_INVALID);
  }
  const product = getPointRedemptionProduct(productId);
  if (!product) {
    throw new ApiError(ApiMessageKey.POINTS_REDEMPTION_PRODUCT_INVALID);
  }

  const entitlements = await getPointRedemptionEntitlements(userId);
  const memberLevel = await getUserMemberLevel(userId);
  const { canRedeem, blockedReason } = evaluateRedeemability(
    product,
    entitlements,
    memberLevel,
  );
  if (!canRedeem) {
    if (blockedReason === 'insufficient') {
      throw new ApiError(ApiMessageKey.POINTS_REDEMPTION_INSUFFICIENT);
    }
    if (blockedReason === 'already_owned') {
      throw new ApiError(ApiMessageKey.POINTS_REDEMPTION_ALREADY_OWNED);
    }
    if (blockedReason === 'member_not_eligible') {
      throw new ApiError(ApiMessageKey.POINTS_REDEMPTION_MEMBER_NOT_ELIGIBLE);
    }
    throw new ApiError(ApiMessageKey.POINTS_REDEMPTION_LIMIT);
  }

  const dedupeSeed =
    clientRequestId?.trim() ||
    `${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  const dedupeKey = buildVerificationPointDedupeKey(
    'redeem',
    userId,
    product.id,
    dedupeSeed,
  );

  const spendType = resolveSpendEventTypeForProduct(product.id);
  const debit = await debitVerificationPoints({
    userId,
    eventType: spendType,
    points: product.costPoints,
    dedupeKey: `vp:${dedupeKey}`,
    meta: { productId: product.id },
  });

  const db = getDb();

  if (debit.credited) {
    const patch: Partial<typeof users.$inferInsert> = {};
    if (product.grantPlanCandidates) {
      patch.bonusPlanCandidates =
        entitlements.bonusPlanCandidates + product.grantPlanCandidates;
    }
    if (product.grantPhotoCount) {
      patch.bonusPhotoCount = entitlements.bonusPhotoCount + product.grantPhotoCount;
    }
    if (product.grantPhotoBytes) {
      patch.bonusPhotoBytes = entitlements.bonusPhotoBytes + product.grantPhotoBytes;
    }
    if (product.grantPosterSticker) {
      patch.posterStickerUnlocked = 1;
    }
    if (Object.keys(patch).length > 0) {
      await db.update(users).set(patch).where(eq(users.id, userId));
    }

    if (
      product.grantMemberLevel != null &&
      product.grantMemberDays != null &&
      product.grantMemberDays > 0
    ) {
      await applyMembershipUpgrade({
        userId,
        targetLevel: product.grantMemberLevel,
        durationDays: product.grantMemberDays,
        source: MembershipChangeSource.SYSTEM,
        remark: `points_redeem:${product.id}`,
      });
    }

    try {
      const [inserted] = await db.insert(pointRedemptions).values({
        userId,
        productId: product.id,
        pointsSpent: product.costPoints,
        dedupeKey,
        meta: {
          spendEventId: debit.eventId,
          grants: {
            planCandidates: product.grantPlanCandidates ?? 0,
            photoCount: product.grantPhotoCount ?? 0,
            photoBytes: product.grantPhotoBytes ?? 0,
            memberLevel: product.grantMemberLevel ?? null,
            memberDays: product.grantMemberDays ?? null,
            posterSticker: product.grantPosterSticker ?? false,
          },
        },
      });
      const redemptionId = Number(inserted.insertId);
      const nextEntitlements = await getPointRedemptionEntitlements(userId);
      return {
        productId: product.id,
        pointsSpent: product.costPoints,
        balance: nextEntitlements.balance,
        entitlements: nextEntitlements,
        redemptionId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('uk_point_redemptions_dedupe') || message.includes('Duplicate')) {
        const nextEntitlements = await getPointRedemptionEntitlements(userId);
        return {
          productId: product.id,
          pointsSpent: 0,
          balance: nextEntitlements.balance,
          entitlements: nextEntitlements,
          redemptionId: 0,
        };
      }
      throw err;
    }
  }

  // 幂等命中：积分已扣过，尽量返回当前权益
  const nextEntitlements = await getPointRedemptionEntitlements(userId);
  return {
    productId: product.id,
    pointsSpent: 0,
    balance: nextEntitlements.balance,
    entitlements: nextEntitlements,
    redemptionId: 0,
  };
}

/**
 * 读取用户额外规划候选数（供会员/规划服务叠加）。
 *
 * @param userId - 用户 ID
 * @returns 额外候选数
 */
export async function getUserBonusPlanCandidates(userId: number): Promise<number> {
  const row = await loadUserEntitlementRow(userId);
  return Number(row?.bonusPlanCandidates ?? 0);
}

/**
 * 读取用户相册兑换加成。
 *
 * @param userId - 用户 ID
 * @returns 额外张数与字节
 */
export async function getUserBonusPhotoQuota(userId: number): Promise<{
  bonusPhotoCount: number;
  bonusPhotoBytes: number;
}> {
  const row = await loadUserEntitlementRow(userId);
  return {
    bonusPhotoCount: Number(row?.bonusPhotoCount ?? 0),
    bonusPhotoBytes: Number(row?.bonusPhotoBytes ?? 0),
  };
}

/**
 * 是否已解锁海报贴纸。
 *
 * @param userId - 用户 ID
 * @returns 已解锁
 */
export async function isPosterStickerUnlocked(userId: number): Promise<boolean> {
  const row = await loadUserEntitlementRow(userId);
  return row?.posterStickerUnlocked === 1;
}
