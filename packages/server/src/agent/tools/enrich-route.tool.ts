import type { LocaleCode, TravelIntentSnapshot } from '@douxing/shared';
import { resolvePlanningCity } from '../../services/travel-intent.service.js';
import type { GeneratedRouteDraft } from '../../services/route-generator.service.js';
import { enrichRouteDraft } from '../../services/route-enricher.service.js';
import { retrievePlaybooksForPlanning } from '../../services/playbook-rag.service.js';
import { enrichRouteInputSchema, toolFail, toolSuccess } from './schemas.js';

export async function runEnrichRouteTool(raw: unknown) {
  const parsed = enrichRouteInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const draft = parsed.data.draft as unknown as GeneratedRouteDraft;
  const intent = parsed.data.intent as unknown as TravelIntentSnapshot;
  const playbooks = await retrievePlaybooksForPlanning({
    city: resolvePlanningCity(intent) ?? draft.matchedCity,
    themes: intent.themes,
  });
  const enriched = await enrichRouteDraft(draft, {
    intent,
    locale: parsed.data.locale as LocaleCode | undefined,
    playbooks,
  });

  return toolSuccess({ draft: enriched });
}
