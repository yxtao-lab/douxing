import type { LocaleCode, TravelIntentSnapshot } from '@douxing/shared';
import type { GeneratedRouteDraft } from '../../services/route-generator.service.js';
import { patchRouteDay } from '../../services/patch-route-day.service.js';
import { patchRouteDayInputSchema, toolFail, toolSuccess } from './schemas.js';

export async function runPatchRouteDayTool(raw: unknown) {
  const parsed = patchRouteDayInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const draft = await patchRouteDay({
    draft: parsed.data.draft as unknown as GeneratedRouteDraft,
    dayIndex: parsed.data.dayIndex,
    intent: parsed.data.intent as unknown as TravelIntentSnapshot,
    locale: parsed.data.locale as LocaleCode | undefined,
    relaxed: parsed.data.relaxed,
    excludeNames: parsed.data.excludeNames,
    prompt: parsed.data.prompt,
  });

  return toolSuccess({ draft });
}
