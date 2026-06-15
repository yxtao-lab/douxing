import { MemberLevel } from './constants.js';

/** 各会员等级照片存储配额 */
export interface MemberPhotoQuota {
  maxBytes: number;
  maxCount: number;
  maxFileBytes: number;
}

/** 各会员等级照片存储配额（容量 + 张数 + 单张上限） */
export const MEMBER_PHOTO_QUOTAS: Record<number, MemberPhotoQuota> = {
  [MemberLevel.FREE]: {
    maxBytes: 500 * 1024 * 1024,
    maxCount: 200,
    maxFileBytes: 10 * 1024 * 1024,
  },
  [MemberLevel.SILVER]: {
    maxBytes: 2 * 1024 * 1024 * 1024,
    maxCount: 1000,
    maxFileBytes: 15 * 1024 * 1024,
  },
  [MemberLevel.GOLD]: {
    maxBytes: 10 * 1024 * 1024 * 1024,
    maxCount: 5000,
    maxFileBytes: 20 * 1024 * 1024,
  },
  [MemberLevel.VIP]: {
    maxBytes: 50 * 1024 * 1024 * 1024,
    maxCount: 20000,
    maxFileBytes: 25 * 1024 * 1024,
  },
};

/** 各会员等级可生成的规划候选方案数 */
export const MEMBER_PLAN_CANDIDATE_COUNTS: Record<number, number> = {
  [MemberLevel.FREE]: 1,
  [MemberLevel.SILVER]: 2,
  [MemberLevel.GOLD]: 3,
  [MemberLevel.VIP]: 5,
};

/** 各会员等级是否支持规划会话内多轮追问调整 */
export const MEMBER_PLAN_APPEND_ALLOWED: Record<number, boolean> = {
  [MemberLevel.FREE]: false,
  [MemberLevel.SILVER]: true,
  [MemberLevel.GOLD]: true,
  [MemberLevel.VIP]: true,
};

export const MEMBER_LEVEL_LABELS: Record<number, string> = {
  [MemberLevel.FREE]: '免费会员',
  [MemberLevel.SILVER]: '白银会员',
  [MemberLevel.GOLD]: '黄金会员',
  [MemberLevel.VIP]: 'VIP 会员',
};

/** 各会员等级展示图标（跨端统一） */
export const MEMBER_LEVEL_ICONS: Record<number, string> = {
  [MemberLevel.FREE]: '🎫',
  [MemberLevel.SILVER]: '🥈',
  [MemberLevel.GOLD]: '🥇',
  [MemberLevel.VIP]: '💎',
};

export type MemberLevelBadgeClass = 'free' | 'silver' | 'gold' | 'vip';

const ORDERED_LEVELS = [
  MemberLevel.FREE,
  MemberLevel.SILVER,
  MemberLevel.GOLD,
  MemberLevel.VIP,
] as const;

export function normalizeMemberLevel(level: number | null | undefined): number {
  if (level == null || !Number.isFinite(level)) return MemberLevel.FREE;
  const normalized = Math.trunc(level);
  if (normalized in MEMBER_PLAN_CANDIDATE_COUNTS) return normalized;
  return MemberLevel.FREE;
}

export function getMemberLevelLabel(level: number | null | undefined): string {
  return MEMBER_LEVEL_LABELS[normalizeMemberLevel(level)] ?? MEMBER_LEVEL_LABELS[MemberLevel.FREE];
}

export function getMemberLevelIcon(level: number | null | undefined): string {
  const normalized = normalizeMemberLevel(level);
  return MEMBER_LEVEL_ICONS[normalized] ?? MEMBER_LEVEL_ICONS[MemberLevel.FREE];
}

export function getMemberLevelBadgeClass(level: number | null | undefined): MemberLevelBadgeClass {
  const normalized = normalizeMemberLevel(level);
  if (normalized >= MemberLevel.VIP) return 'vip';
  if (normalized >= MemberLevel.GOLD) return 'gold';
  if (normalized >= MemberLevel.SILVER) return 'silver';
  return 'free';
}

/** 根据会员等级返回首条规划可生成的候选方案数 */
export function getPlanCandidateCountByMemberLevel(level: number | null | undefined): number {
  const normalized = normalizeMemberLevel(level);
  return MEMBER_PLAN_CANDIDATE_COUNTS[normalized] ?? MEMBER_PLAN_CANDIDATE_COUNTS[MemberLevel.FREE];
}

/** 会员等级是否支持规划追问调整 */
export function canAppendPlanByMemberLevel(level: number | null | undefined): boolean {
  const normalized = normalizeMemberLevel(level);
  return MEMBER_PLAN_APPEND_ALLOWED[normalized] ?? false;
}

/** 根据会员等级返回照片存储配额 */
export function getPhotoQuotaByMemberLevel(level: number | null | undefined): MemberPhotoQuota {
  const normalized = normalizeMemberLevel(level);
  return MEMBER_PHOTO_QUOTAS[normalized] ?? MEMBER_PHOTO_QUOTAS[MemberLevel.FREE];
}

export function getAllMembershipTiers() {
  return ORDERED_LEVELS.map((level) => ({
    level,
    planCandidateCount: getPlanCandidateCountByMemberLevel(level),
    canAppendPlan: canAppendPlanByMemberLevel(level),
    photoQuota: getPhotoQuotaByMemberLevel(level),
  }));
}

/** 可购买的会员套餐（MVP：按月订阅，价格可后续改为 DB 配置） */
export interface MembershipProduct {
  id: number;
  targetLevel: number;
  durationDays: number;
  price: number;
}

export const MEMBERSHIP_PRODUCTS: MembershipProduct[] = [
  { id: 101, targetLevel: MemberLevel.SILVER, durationDays: 30, price: 9.9 },
  { id: 102, targetLevel: MemberLevel.GOLD, durationDays: 30, price: 19.9 },
  { id: 103, targetLevel: MemberLevel.VIP, durationDays: 30, price: 39.9 },
];

export function getMembershipProductById(productId: number): MembershipProduct | undefined {
  return MEMBERSHIP_PRODUCTS.find((item) => item.id === productId);
}

export function getMembershipProductByLevel(level: number): MembershipProduct | undefined {
  const normalized = normalizeMemberLevel(level);
  return MEMBERSHIP_PRODUCTS.find((item) => item.targetLevel === normalized);
}

export function getEffectiveMemberLevel(
  level: number | null | undefined,
  memberExpiresAt?: string | Date | null,
): number {
  const normalized = normalizeMemberLevel(level);
  if (normalized <= MemberLevel.FREE) return MemberLevel.FREE;
  if (!memberExpiresAt) return normalized;
  const expiresMs = new Date(memberExpiresAt).getTime();
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) return MemberLevel.FREE;
  return normalized;
}

export function buildMembershipInfo(
  level: number | null | undefined,
  options?: { memberExpiresAt?: string | Date | null },
) {
  const storedLevel = normalizeMemberLevel(level);
  const memberExpiresAt = options?.memberExpiresAt
    ? new Date(options.memberExpiresAt).toISOString()
    : null;
  const isExpired =
    storedLevel > MemberLevel.FREE &&
    memberExpiresAt != null &&
    new Date(memberExpiresAt).getTime() <= Date.now();
  const effectiveLevel = getEffectiveMemberLevel(storedLevel, memberExpiresAt);
  const currentIndex = ORDERED_LEVELS.indexOf(
    effectiveLevel as (typeof ORDERED_LEVELS)[number],
  );
  const nextLevel =
    currentIndex >= 0 && currentIndex < ORDERED_LEVELS.length - 1
      ? ORDERED_LEVELS[currentIndex + 1]
      : null;

  return {
    level: effectiveLevel,
    storedLevel,
    label: getMemberLevelLabel(effectiveLevel),
    planCandidateCount: getPlanCandidateCountByMemberLevel(effectiveLevel),
    canAppendPlan: canAppendPlanByMemberLevel(effectiveLevel),
    memberExpiresAt,
    isExpired,
    nextLevel: nextLevel
      ? {
          level: nextLevel,
          label: getMemberLevelLabel(nextLevel),
          planCandidateCount: getPlanCandidateCountByMemberLevel(nextLevel),
          canAppendPlan: canAppendPlanByMemberLevel(nextLevel),
        }
      : null,
  };
}

export type MembershipInfo = ReturnType<typeof buildMembershipInfo>;
export type MembershipTierInfo = ReturnType<typeof getAllMembershipTiers>[number];
