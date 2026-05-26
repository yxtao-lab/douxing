import { MemberLevel } from './constants.js';

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

export function getAllMembershipTiers() {
  return ORDERED_LEVELS.map((level) => ({
    level,
    planCandidateCount: getPlanCandidateCountByMemberLevel(level),
    canAppendPlan: canAppendPlanByMemberLevel(level),
  }));
}

export function buildMembershipInfo(level: number | null | undefined) {
  const normalized = normalizeMemberLevel(level);
  const currentIndex = ORDERED_LEVELS.indexOf(normalized as (typeof ORDERED_LEVELS)[number]);
  const nextLevel =
    currentIndex >= 0 && currentIndex < ORDERED_LEVELS.length - 1
      ? ORDERED_LEVELS[currentIndex + 1]
      : null;

  return {
    level: normalized,
    label: getMemberLevelLabel(normalized),
    planCandidateCount: getPlanCandidateCountByMemberLevel(normalized),
    canAppendPlan: canAppendPlanByMemberLevel(normalized),
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
