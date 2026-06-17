/**

 * Phase 1/3：调用 Python Agent 或本地 Agent 路径

 */

import type {

  LocaleCode,

  PlanChatMessage,

  TravelIntentSnapshot,

  AgentToolTraceEntry,

} from '@douxing/shared';

import {

  buildBudgetTunedAssistantHint,

  buildLodgingTunedAssistantHint,

} from '@douxing/shared';

import {

  getAgentPlanTimeoutMs,

  getAiServiceBaseUrl,

  isAgentPlanEnabled,

} from '../config/agent.js';

import type { GeneratedRouteDraft } from './route-generator.service.js';

import { routeAgentIntent, type RoutedAgentIntent } from './agent-intent-router.service.js';

import { patchRouteDay, resolveDayIndexForExclusion } from './patch-route-day.service.js';

import { tuneRouteBudget } from './tune-route-budget.service.js';

import { answerFoodQa } from './answer-food-qa.service.js';

import { resolvePlanVariantSelection } from './select-plan-variant.service.js';

import { enrichRouteDraft } from './route-enricher.service.js';

import { validateRouteDraft } from './validate-route.service.js';

import { retrievePlaybooksForPlanning } from './playbook-rag.service.js';

import { generateRoute } from './route-generator.service.js';

import { loadPlanUserContext } from './plan-user-context.service.js';

import { resolvePlanningCity } from './travel-intent.service.js';



export interface AgentPlanRequest {

  prompt: string;

  userId: number;

  sessionId?: number;

  history?: PlanChatMessage[];

  days?: number;

  budget?: string;

  locale?: LocaleCode;

  provider?: string;

  currentDraft?: GeneratedRouteDraft;

  intent?: TravelIntentSnapshot;

}



export interface AgentPlanResult {

  draft?: GeneratedRouteDraft & { generationSource?: string; intent?: TravelIntentSnapshot };

  toolTrace: AgentToolTraceEntry[];

  routedIntent: string;

  assistantHint?: string;

  assistantMessage?: string;

  selectedRouteId?: number;

}



function isAgentPlanResultUsable(result: AgentPlanResult | null | undefined): result is AgentPlanResult {

  if (!result) return false;

  return !!(result.draft || result.assistantMessage || result.selectedRouteId != null);

}



async function finalizeDraftWithEnrich(

  draft: GeneratedRouteDraft,

  intent: TravelIntentSnapshot,

  locale: LocaleCode | undefined,

  trace: AgentToolTraceEntry[],

): Promise<GeneratedRouteDraft> {

  const t0 = Date.now();

  const playbooks = await retrievePlaybooksForPlanning({

    city: resolvePlanningCity(intent) ?? draft.matchedCity,

    themes: intent.themes,

  });

  const enriched = await enrichRouteDraft(draft, { intent, locale, playbooks });

  trace.push({ tool: 'enrich_route', ok: true, ms: Date.now() - t0 });



  const t1 = Date.now();

  const validated = validateRouteDraft(enriched, { locale, autoFix: true });

  trace.push({ tool: 'validate_route', ok: true, ms: Date.now() - t1 });

  return validated.draft;

}



async function callRemoteAgentPlan(

  request: AgentPlanRequest,

): Promise<AgentPlanResult | null> {

  const baseUrl = getAiServiceBaseUrl().replace(/\/$/, '');

  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), getAgentPlanTimeoutMs());



  try {

    const res = await fetch(`${baseUrl}/v1/agent/plan`, {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(request),

      signal: controller.signal,

    });

    if (!res.ok) return null;

    return (await res.json()) as AgentPlanResult;

  } catch {

    return null;

  } finally {

    clearTimeout(timer);

  }

}



function resolvePatchDayIndex(
  draft: GeneratedRouteDraft,
  routed: RoutedAgentIntent,
): number | undefined {
  if (routed.dayIndex != null) return routed.dayIndex;
  if (routed.excludePoiNames?.length) {
    return resolveDayIndexForExclusion(draft, routed.excludePoiNames);
  }
  return undefined;
}

async function runLocalAgentPlan(request: AgentPlanRequest): Promise<AgentPlanResult> {

  const trace: AgentPlanResult['toolTrace'] = [];

  const routed = routeAgentIntent(request.prompt);

  const intent = request.intent;

  const locale = request.locale;

  const draft = request.currentDraft;



  if (routed.route === 'select_variant' && request.sessionId) {

    const t0 = Date.now();

    const selected = await resolvePlanVariantSelection(

      request.sessionId,

      request.userId,

      request.prompt,

      locale,

    );

    trace.push({ tool: 'select_plan_variant', ok: !!selected, ms: Date.now() - t0 });

    if (selected) {

      return {

        toolTrace: trace,

        routedIntent: routed.route,

        selectedRouteId: selected.routeId,

        assistantMessage: selected.assistantMessage,

      };

    }

  }



  if (routed.route === 'qa_food' && intent) {

    const t0 = Date.now();

    const assistantMessage = await answerFoodQa({

      intent,

      prompt: request.prompt,

      locale,

      userId: request.userId,

    });

    trace.push({ tool: 'answer_food_qa', ok: true, ms: Date.now() - t0 });

    return {

      toolTrace: trace,

      routedIntent: routed.route,

      assistantMessage,

    };

  }



  if (draft && intent) {

    const patchDayIndex = resolvePatchDayIndex(draft, routed);

    if (

      (routed.route === 'tweak_day' || routed.route === 'tweak_poi') &&

      patchDayIndex != null

    ) {

      const t0 = Date.now();

      const patched = await patchRouteDay({

        draft,

        dayIndex: patchDayIndex,

        intent,

        locale,

        relaxed: routed.relaxed,

        excludeNames: routed.excludePoiNames,

        prompt: request.prompt,

        skipFinalize: true,

      });

      trace.push({ tool: 'patch_route_day', ok: true, ms: Date.now() - t0 });

      const finalized = await finalizeDraftWithEnrich(patched, intent, locale, trace);

      return {

        draft: { ...finalized, generationSource: 'llm', intent },

        toolTrace: trace,

        routedIntent: routed.route,

        assistantHint: '已局部调整指定天行程',

      };

    }



    if (routed.route === 'budget_tune') {

      const t0 = Date.now();

      const tuned = tuneRouteBudget({ draft, intent, locale });

      trace.push({ tool: 'tune_route_budget', ok: true, ms: Date.now() - t0 });

      const finalized = await finalizeDraftWithEnrich(tuned, intent, locale, trace);

      return {

        draft: { ...finalized, generationSource: 'llm', intent },

        toolTrace: trace,

        routedIntent: routed.route,

        assistantHint: buildBudgetTunedAssistantHint(locale ?? 'zh-CN'),

      };

    }



    if (routed.route === 'lodging_tune') {

      trace.push({ tool: 'lodging_tune', ok: true, ms: 0 });

      const finalized = await finalizeDraftWithEnrich(draft, intent, locale, trace);

      return {

        draft: { ...finalized, generationSource: 'llm', intent },

        toolTrace: trace,

        routedIntent: routed.route,

        assistantHint: buildLodgingTunedAssistantHint(locale ?? 'zh-CN'),

      };

    }

  }



  const context = await loadPlanUserContext(request.userId);

  const genStart = Date.now();

  const result = await generateRoute({

    prompt: request.prompt,

    history: request.history,

    days: request.days,

    budget: request.budget,

    provider: request.provider as 'auto' | 'deepseek' | 'lmstudio' | undefined,

    locale,

    intent,

    userId: request.userId,

    excludePoiNames: context.excludePoiNames,

    boostPoiNames: context.boostPoiNames,

  });

  trace.push({ tool: 'generate_route_draft', ok: true, ms: Date.now() - genStart });



  return {

    draft: result,

    toolTrace: trace,

    routedIntent: routed.route,

  };

}



export async function runAgentPlan(

  request: AgentPlanRequest,

): Promise<AgentPlanResult | null> {

  if (!isAgentPlanEnabled()) return null;



  const remote = await callRemoteAgentPlan(request);

  if (isAgentPlanResultUsable(remote)) return remote;



  const local = await runLocalAgentPlan(request);

  if (isAgentPlanResultUsable(local)) return local;

  return null;

}



export { isAgentPlanEnabled };


