import { MemberLevel } from './constants.js';

/** 各会员等级可生成的规划候选方案数 */
export const MEMBER_PLAN_CANDIDATE_COUNTS: Record<number, number> = {
  [MemberLevel.FREE]: 2,
  [MemberLevel.SILVER]: 3,
  [MemberLevel.GOLD]: 4,
  [MemberLevel.VIP]: 5,
};

export const MEMBER_LEVEL_LABELS: Record<number, string> = {
  [MemberLevel.FREE]: '免费会员',
  [MemberLevel.SILVER]: '白银会员',
  [MemberLevel.GOLD]: '黄金会员',
  [MemberLevel.VIP]: 'VIP 会员',
};

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

/** 根据会员等级返回首条规划可生成的候选方案数（默认 2 套） */
export function getPlanCandidateCountByMemberLevel(level: number | null | undefined): number {
  const normalized = normalizeMemberLevel(level);
  return MEMBER_PLAN_CANDIDATE_COUNTS[normalized] ?? MEMBER_PLAN_CANDIDATE_COUNTS[MemberLevel.FREE];
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
    nextLevel: nextLevel
      ? {
          level: nextLevel,
          label: getMemberLevelLabel(nextLevel),
          planCandidateCount: getPlanCandidateCountByMemberLevel(nextLevel),
        }
      : null,
  };
}

export type MembershipInfo = ReturnType<typeof buildMembershipInfo>;
