/**
 * G-INCENTIVE-01：验证积分兑换目录与规则（消耗侧，与热度/可信度分离）。
 * 成本与发放量集中配置，禁止业务散落魔法数。
 */

/** 兑换商品 ID */
export const PointRedemptionProductId = {
  /** 额外 AI 规划候选数 +1 */
  AI_PLAN_PACK: 'ai_plan_pack',
  /** 相册配额扩容 */
  PHOTO_QUOTA_PACK: 'photo_quota_pack',
  /** 白银会员体验（天数见 catalog） */
  MEMBER_TRIAL_SILVER: 'member_trial_silver',
  /** 海报贴纸包解锁 */
  POSTER_STICKER: 'poster_sticker',
} as const;

export type PointRedemptionProductIdValue =
  (typeof PointRedemptionProductId)[keyof typeof PointRedemptionProductId];

/** 兑换商品定义 */
export interface PointRedemptionProduct {
  id: PointRedemptionProductIdValue;
  /** 消耗验证积分 */
  costPoints: number;
  /** 发放：额外规划候选数 */
  grantPlanCandidates?: number;
  /** 发放：额外相册张数 */
  grantPhotoCount?: number;
  /** 发放：额外相册字节 */
  grantPhotoBytes?: number;
  /** 发放：会员体验目标等级（MemberLevel） */
  grantMemberLevel?: number;
  /** 发放：会员体验天数 */
  grantMemberDays?: number;
  /** 发放：解锁海报贴纸 */
  grantPosterSticker?: boolean;
  /** 单用户累计上限（可选；会员体验/贴纸不走此上限） */
  maxOwned?: number;
}

/** 相册扩容包：+100 张 / +200MB */
export const PHOTO_QUOTA_PACK_BYTES = 200 * 1024 * 1024;

/** 兑换目录（有序） */
export const POINT_REDEMPTION_CATALOG: readonly PointRedemptionProduct[] = [
  {
    id: PointRedemptionProductId.AI_PLAN_PACK,
    costPoints: 50,
    grantPlanCandidates: 1,
    maxOwned: 5,
  },
  {
    id: PointRedemptionProductId.PHOTO_QUOTA_PACK,
    costPoints: 40,
    grantPhotoCount: 100,
    grantPhotoBytes: PHOTO_QUOTA_PACK_BYTES,
    maxOwned: 20,
  },
  {
    id: PointRedemptionProductId.MEMBER_TRIAL_SILVER,
    costPoints: 120,
    grantMemberLevel: 1,
    grantMemberDays: 7,
  },
  {
    id: PointRedemptionProductId.POSTER_STICKER,
    costPoints: 25,
    grantPosterSticker: true,
  },
] as const;

const CATALOG_BY_ID = new Map(
  POINT_REDEMPTION_CATALOG.map((item) => [item.id, item] as const),
);

/**
 * 按 ID 取兑换商品。
 *
 * @param productId - 商品 ID
 * @returns 商品；不存在则为 null
 */
export function getPointRedemptionProduct(
  productId: string,
): PointRedemptionProduct | null {
  return CATALOG_BY_ID.get(productId as PointRedemptionProductIdValue) ?? null;
}

/**
 * 判断是否为合法兑换商品 ID。
 *
 * @param value - 原始值
 * @returns 是否合法
 */
export function isPointRedemptionProductId(
  value: string,
): value is PointRedemptionProductIdValue {
  return CATALOG_BY_ID.has(value as PointRedemptionProductIdValue);
}

/** 消耗事件类型（写入验证积分账本，points 为负） */
export const VerificationPointSpendEventType = {
  REDEEM_AI_PLAN: 'redeem_ai_plan',
  REDEEM_PHOTO_QUOTA: 'redeem_photo_quota',
  REDEEM_MEMBER_TRIAL: 'redeem_member_trial',
  REDEEM_POSTER_STICKER: 'redeem_poster_sticker',
} as const;

export type VerificationPointSpendEventTypeValue =
  (typeof VerificationPointSpendEventType)[keyof typeof VerificationPointSpendEventType];

/**
 * 商品对应的账本消耗事件类型。
 *
 * @param productId - 商品 ID
 * @returns 事件类型
 */
export function resolveSpendEventTypeForProduct(
  productId: PointRedemptionProductIdValue,
): VerificationPointSpendEventTypeValue {
  switch (productId) {
    case PointRedemptionProductId.AI_PLAN_PACK:
      return VerificationPointSpendEventType.REDEEM_AI_PLAN;
    case PointRedemptionProductId.PHOTO_QUOTA_PACK:
      return VerificationPointSpendEventType.REDEEM_PHOTO_QUOTA;
    case PointRedemptionProductId.MEMBER_TRIAL_SILVER:
      return VerificationPointSpendEventType.REDEEM_MEMBER_TRIAL;
    case PointRedemptionProductId.POSTER_STICKER:
      return VerificationPointSpendEventType.REDEEM_POSTER_STICKER;
    default:
      return VerificationPointSpendEventType.REDEEM_AI_PLAN;
  }
}

/**
 * 计算相册扩容包已兑换次数（由累计张数反推）。
 *
 * @param bonusPhotoCount - 当前额外张数
 * @param packCount - 单包张数
 * @returns 已兑换包数
 */
export function estimatePhotoPackOwned(
  bonusPhotoCount: number,
  packCount: number,
): number {
  const pack = Math.max(1, Math.floor(packCount) || 1);
  return Math.floor(Math.max(0, bonusPhotoCount) / pack);
}
