import type { LocaleCode } from '@douxing/shared';
import { resolvePlanVariantSelection } from '../../services/select-plan-variant.service.js';
import { selectPlanVariantInputSchema, toolFail, toolSuccess } from './schemas.js';

export async function runSelectPlanVariantTool(raw: unknown) {
  const parsed = selectPlanVariantInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const result = await resolvePlanVariantSelection(
    parsed.data.sessionId,
    parsed.data.userId,
    parsed.data.prompt,
    parsed.data.locale as LocaleCode | undefined,
  );
  if (!result) {
    return toolFail('INVALID_VARIANT', 'INVALID_VARIANT');
  }

  return toolSuccess(result);
}
