import type { TravelIntentSnapshot } from '@douxing/shared';
import {
  applyMemoryContextToIntent,
  loadPlanUserContext,
  type PlanUserContext,
} from '../../services/plan-user-context.service.js';
import { applyMemoryContextInputSchema, toolFail, toolSuccess } from './schemas.js';

export async function runApplyMemoryContextTool(raw: unknown) {
  const parsed = applyMemoryContextInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const intent = parsed.data.intent as unknown as TravelIntentSnapshot;
  const loaded = await loadPlanUserContext(parsed.data.userId);
  const partial = parsed.data.context;

  const mergedContext: PlanUserContext = partial
    ? {
        interestTags: loaded.interestTags,
        memoryThemes: partial.memoryThemes ?? loaded.memoryThemes,
        excludePoiNames: partial.excludePoiNames ?? loaded.excludePoiNames,
        boostPoiNames: partial.boostPoiNames ?? loaded.boostPoiNames,
      }
    : loaded;

  const mergedIntent = applyMemoryContextToIntent(
    intent,
    mergedContext,
    parsed.data.memorySummary,
  );

  return toolSuccess({ intent: mergedIntent, context: mergedContext });
}
