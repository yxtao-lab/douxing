import type { PlanChatMessage, TravelIntentSnapshot } from '@douxing/shared';
import { buildIntentFromHistoryAsync } from '../../services/llm-intent-parser.service.js';
import {
  loadPlanUserContext,
  mergeIntentWithUserContext,
} from '../../services/plan-user-context.service.js';
import { parseIntentInputSchema, toolSuccess, toolFail } from './schemas.js';

export async function runParseIntentTool(raw: unknown) {
  const parsed = parseIntentInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const { prompt, history, days, budget, userId } = parsed.data;
  let intent: TravelIntentSnapshot = await buildIntentFromHistoryAsync(
    history as PlanChatMessage[] | undefined,
    prompt,
    { days, budget },
  );

  if (userId) {
    const context = await loadPlanUserContext(userId);
    intent = mergeIntentWithUserContext(intent, context);
  }

  return toolSuccess({ intent });
}
