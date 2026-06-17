import type { LocaleCode, TravelIntentSnapshot } from '@douxing/shared';
import type { GeneratedRouteDraft } from '../../services/route-generator.service.js';
import { tuneRouteBudget } from '../../services/tune-route-budget.service.js';
import { tuneRouteBudgetInputSchema, toolFail, toolSuccess } from './schemas.js';

export async function runTuneRouteBudgetTool(raw: unknown) {
  const parsed = tuneRouteBudgetInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const draft = tuneRouteBudget({
    draft: parsed.data.draft as unknown as GeneratedRouteDraft,
    intent: parsed.data.intent as unknown as TravelIntentSnapshot,
    locale: parsed.data.locale as LocaleCode | undefined,
  });

  return toolSuccess({ draft });
}
