import type { TravelIntentSnapshot } from '@douxing/shared';

import { getPlanCandidateCountByMemberLevel } from '@douxing/shared';

export interface PlanRouteVariantDef {
  key: string;
}

const BASE_VARIANTS: PlanRouteVariantDef[] = [
  { key: 'classic' },
  { key: 'culture' },
  { key: 'relaxed' },
  { key: 'adventure' },
  { key: 'premium' },
];

/** 兴趣主题覆盖到某槽位的变体 key（themes 为库内中文预设值） */
const THEME_VARIANT_KEY_OVERRIDES: Record<string, { slotIndex: 1 | 2; key: string }> = {
  亲子: { slotIndex: 1, key: 'family' },
  美食: { slotIndex: 2, key: 'food' },
  浪漫: { slotIndex: 2, key: 'romantic' },
  户外: { slotIndex: 1, key: 'outdoor' },
};

/** 根据意图主题与会员配额生成方案变体定义 */
export function buildPlanRouteVariants(
  intent: TravelIntentSnapshot,
  candidateCount = getPlanCandidateCountByMemberLevel(0),
): PlanRouteVariantDef[] {
  const variants = BASE_VARIANTS.map((v) => ({ ...v }));

  for (const theme of intent.themes) {
    const override = THEME_VARIANT_KEY_OVERRIDES[theme];
    if (!override) continue;
    variants[override.slotIndex] = { key: override.key };
  }

  const safeCount = Math.max(1, Math.min(candidateCount, variants.length));
  return variants.slice(0, safeCount);
}

/** @deprecated 使用 getPlanCandidateCountByMemberLevel */
export const PLAN_CANDIDATE_COUNT = 2;
