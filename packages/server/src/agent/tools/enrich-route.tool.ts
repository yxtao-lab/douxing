import type { LocaleCode, TravelIntentSnapshot } from '@douxing/shared';
import { resolvePlanningCity } from '../../services/travel-intent.service.js';
import type { GeneratedRouteDraft } from '../../services/route-generator.service.js';
import { enrichRouteDraft } from '../../services/route-enricher.service.js';
import { runWithExternalApiCounter } from '../../observability/external-api-counter.service.js';
import {
  retrievePlaybooksForPlanning,
  type MatchedRoutePlaybook,
} from '../../services/playbook-rag.service.js';
import { enrichRouteInputSchema, toolFail, toolSuccess } from './schemas.js';

/**
 * 对路线草稿执行 Enricher（交通/坐标/玩法注入）；playbooks 可来自上游 retrieve_playbooks。
 *
 * @param raw - Tool 入参（draft/intent/locale/playbooks?）
 * @returns  enriched draft；校验失败时返回 toolFail
 */
export async function runEnrichRouteTool(raw: unknown) {
  const parsed = enrichRouteInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const draft = parsed.data.draft as unknown as GeneratedRouteDraft;
  const intent = parsed.data.intent as unknown as TravelIntentSnapshot;
  const playbooks: MatchedRoutePlaybook[] = parsed.data.playbooks?.length
    ? (parsed.data.playbooks as unknown as MatchedRoutePlaybook[])
    : await retrievePlaybooksForPlanning({
        city: resolvePlanningCity(intent) ?? draft.matchedCity,
        themes: intent.themes,
      });
  const { result: enriched, externalApiCalls } = await runWithExternalApiCounter(() =>
    enrichRouteDraft(draft, {
      intent,
      locale: parsed.data.locale as LocaleCode | undefined,
      playbooks,
    }),
  );

  return toolSuccess({ draft: enriched, externalApiCalls });
}
