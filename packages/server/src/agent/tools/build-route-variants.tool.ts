import {
  formatPlanVariantHint,
  formatPlanVariantLabel,
  getPlanCandidateCountByMemberLevel,
  type LocaleCode,
  type TravelIntentSnapshot,
} from '@douxing/shared';
import { buildPlanRouteVariants } from '../../config/plan-route-variants.js';
import { getPlanCandidateCountForUser } from '../../services/membership.service.js';
import { buildRouteVariantsInputSchema, toolFail, toolSuccess } from './schemas.js';

export async function runBuildRouteVariantsTool(raw: unknown) {
  const parsed = buildRouteVariantsInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const intent = parsed.data.intent as unknown as TravelIntentSnapshot;
  const locale = (parsed.data.locale ?? 'zh-CN') as LocaleCode;

  let candidateCount = parsed.data.candidateCount;
  if (parsed.data.userId != null) {
    candidateCount = await getPlanCandidateCountForUser(parsed.data.userId);
  }
  if (candidateCount == null) {
    candidateCount = getPlanCandidateCountByMemberLevel(0);
  }

  const defs = buildPlanRouteVariants(intent, candidateCount);
  const variants = defs.map((def, sortOrder) => ({
    key: def.key,
    label: formatPlanVariantLabel(def.key, locale),
    hint: formatPlanVariantHint(def.key, locale),
    sortOrder,
  }));

  return toolSuccess({
    variants,
    candidateCount: variants.length,
  });
}
