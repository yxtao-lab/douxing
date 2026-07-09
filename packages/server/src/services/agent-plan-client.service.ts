/**

 * Phase 1/3：调用 Python Agent 或本地 Agent 路径

 */

import type {

  LocaleCode,

  PlanChatMessage,

  TravelIntentSnapshot,

  AgentToolTraceEntry,

  MemoryRecallExplainItem,

  WorkflowTemplateNodeConfig,
  WorkflowGraphDefinition,
  PlanSessionStreamToolCallPayload,

} from '@douxing/shared';

import {

  buildBudgetTunedAssistantHint,

  buildLodgingTunedAssistantHint,

  WorkflowNodeSpanRecorder,

  digestWorkflowPayload,
  consumeSseBuffer,

} from '@douxing/shared';

import {

  getAgentPlanTimeoutMs,

  getAiServiceBaseUrl,

  isAgentPlanEnabled,

  getAgentPlanDefaultProvider,

} from '../config/agent.js';

import type { GeneratedRouteDraft } from './route-generator.service.js';

import { routeAgentIntent, type RoutedAgentIntent } from './agent-intent-router.service.js';

import { patchRouteDay, resolveDayIndexForExclusion } from './patch-route-day.service.js';

import { tuneRouteBudget } from './tune-route-budget.service.js';

import { answerFoodQa } from './answer-food-qa.service.js';

import { resolvePlanVariantSelection } from './select-plan-variant.service.js';

import { generateRoute } from './route-generator.service.js';

import { loadPlanUserContext } from './plan-user-context.service.js';

import { resolvePlanningCity } from './travel-intent.service.js';

import { runBuildRouteVariantsTool } from '../agent/tools/build-route-variants.tool.js';
import { runRecallUserMemoryTool } from '../agent/tools/memory.tools.js';
import { runApplyMemoryContextTool } from '../agent/tools/apply-memory-context.tool.js';
import { runRetrievePlaybooksTool } from '../agent/tools/retrieve-playbooks.tool.js';
import { runEnrichRouteTool } from '../agent/tools/enrich-route.tool.js';
import { runValidateRouteTool } from '../agent/tools/validate-route.tool.js';
import { runRetrieveAttractionsTool } from '../agent/tools/retrieve-attractions.tool.js';
import { runSelectWorkflowTemplateTool } from '../agent/tools/select-workflow-template.tool.js';



export interface AgentPlanCandidateDraft {
  draft: GeneratedRouteDraft & { generationSource?: string; intent?: TravelIntentSnapshot };
  variantKey: string;
  label: string;
  sortOrder: number;
}



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

  /** 管理端沙箱：强制使用草稿 graphDef 编译 template 引擎 */
  graphDefOverride?: WorkflowGraphDefinition;

}



/** Step 7：规划 SSE 回调（Tool 开始/结束） */
export interface AgentPlanStreamHooks {
  onToolStart?: (tool: string) => void;
  onToolEnd?: (tool: string, ok: boolean, ms: number, span?: AgentToolTraceEntry) => void;
}



export interface AgentPlanResult {

  draft?: GeneratedRouteDraft & { generationSource?: string; intent?: TravelIntentSnapshot };

  /** Step 13：首句多候选（与管道 plan_session_candidates 对齐） */
  candidates?: AgentPlanCandidateDraft[];

  toolTrace: AgentToolTraceEntry[];

  routedIntent: string;

  assistantHint?: string;

  assistantMessage?: string;

  selectedRouteId?: number;

  memories?: Array<{
    id: number;
    memoryType: string;
    content: string;
    importance: number;
  }>;

  memorySummary?: string;

  recallExplain?: MemoryRecallExplainItem[];

}



function isAgentPlanResultUsable(result: AgentPlanResult | null | undefined): result is AgentPlanResult {

  if (!result) return false;

  return !!(result.draft || result.candidates?.length || result.assistantMessage || result.selectedRouteId != null);

}



async function finalizeDraftWithEnrich(
  draft: GeneratedRouteDraft,
  intent: TravelIntentSnapshot,
  locale: LocaleCode | undefined,
  trace: AgentToolTraceEntry[],
  hooks?: AgentPlanStreamHooks,
  templateNodeConfig?: WorkflowTemplateNodeConfig,
): Promise<GeneratedRouteDraft> {
  const spanRecorder = new WorkflowNodeSpanRecorder(trace);
  const city = resolvePlanningCity(intent) ?? draft.matchedCity;

  const pbStart = Date.now();
  hooks?.onToolStart?.('retrieve_playbooks');
  const playbookResult = await runRetrievePlaybooksTool({
    city,
    themes: intent.themes,
    prompt: intent.city ?? draft.name,
    limit: templateNodeConfig?.playbookLimit,
  });
  const pbMs = Date.now() - pbStart;
  if (!playbookResult.ok) {
    spanRecorder.push({
      tool: 'retrieve_playbooks',
      ok: false,
      ms: pbMs,
      errorCode: playbookResult.error.code,
      outputDigest: digestWorkflowPayload(playbookResult.error.message),
    });
    hooks?.onToolEnd?.('retrieve_playbooks', false, pbMs);
    throw new Error(playbookResult.error.message);
  }
  const playbooks = playbookResult.data.playbooks;
  spanRecorder.push({
    tool: 'retrieve_playbooks',
    ok: true,
    ms: pbMs,
    matchedPlaybookIds: playbookResult.data.matchedPlaybookIds,
    inputDigest: digestWorkflowPayload({ city, themes: intent.themes }),
    outputDigest: digestWorkflowPayload({
      count: playbooks.length,
      ids: playbookResult.data.matchedPlaybookIds.slice(0, 5),
    }),
  });
  hooks?.onToolEnd?.('retrieve_playbooks', true, pbMs);

  const enrichStart = Date.now();
  hooks?.onToolStart?.('enrich_route');
  const enrichResult = await runEnrichRouteTool({
    draft,
    intent,
    locale,
    playbooks,
  });
  const enrichMs = Date.now() - enrichStart;
  if (!enrichResult.ok) {
    spanRecorder.push({
      tool: 'enrich_route',
      ok: false,
      ms: enrichMs,
      errorCode: enrichResult.error.code,
    });
    hooks?.onToolEnd?.('enrich_route', false, enrichMs);
    throw new Error(enrichResult.error.message);
  }
  const enriched = enrichResult.data.draft as GeneratedRouteDraft;
  spanRecorder.push({
    tool: 'enrich_route',
    ok: true,
    ms: enrichMs,
    externalApiCalls:
      typeof enrichResult.data.externalApiCalls === 'number'
        ? enrichResult.data.externalApiCalls
        : undefined,
    inputDigest: digestWorkflowPayload({ city: draft.matchedCity, days: draft.days }),
  });
  hooks?.onToolEnd?.('enrich_route', true, enrichMs);

  const validateStart = Date.now();
  hooks?.onToolStart?.('validate_route');
  const validateResult = await runValidateRouteTool({
    draft: enriched,
    locale,
    autoFix: true,
  });
  const validateMs = Date.now() - validateStart;
  if (!validateResult.ok) {
    spanRecorder.push({
      tool: 'validate_route',
      ok: false,
      ms: validateMs,
      errorCode: validateResult.error.code,
    });
    hooks?.onToolEnd?.('validate_route', false, validateMs);
    throw new Error(validateResult.error.message);
  }
  spanRecorder.push({
    tool: 'validate_route',
    ok: true,
    ms: validateMs,
  });
  hooks?.onToolEnd?.('validate_route', true, validateMs);

  return validateResult.data.draft as GeneratedRouteDraft;
}



async function generatePlanNewCandidates(
  request: AgentPlanRequest,
  intent: TravelIntentSnapshot,
  routedIntent: string,
  trace: AgentPlanResult['toolTrace'],
  hooks?: AgentPlanStreamHooks,
): Promise<AgentPlanResult> {
  const locale = request.locale ?? 'zh-CN';
  const context = await loadPlanUserContext(request.userId);
  const spanRecorder = new WorkflowNodeSpanRecorder(trace);

  const selStart = Date.now();
  hooks?.onToolStart?.('select_workflow_template');
  const selResult = await runSelectWorkflowTemplateTool({
    userId: request.userId,
    intent,
    routedIntent,
  });
  const selMs = Date.now() - selStart;
  if (!selResult.ok) {
    spanRecorder.push({
      tool: 'select_workflow_template',
      ok: false,
      ms: selMs,
      errorCode: selResult.error.code,
    });
    hooks?.onToolEnd?.('select_workflow_template', false, selMs);
    throw new Error(selResult.error.message);
  }
  const templateNodeConfig = selResult.data.nodeConfig;
  spanRecorder.push({
    tool: 'select_workflow_template',
    ok: true,
    ms: selMs,
    inputDigest: selResult.data.inputDigest,
    outputDigest: selResult.data.outputDigest,
  });
  hooks?.onToolEnd?.('select_workflow_template', true, selMs);

  const ragStart = Date.now();
  hooks?.onToolStart?.('retrieve_attractions');
  const ragResult = await runRetrieveAttractionsTool({
    city: resolvePlanningCity(intent) ?? undefined,
    themes: intent.themes,
    prompt: request.prompt,
    days: intent.days ?? request.days,
    excludeNames: context.excludePoiNames,
    boostNames: context.boostPoiNames,
    limit: templateNodeConfig.topK,
    mmrLambda: templateNodeConfig.mmrLambda,
  });
  const ragMs = Date.now() - ragStart;
  if (!ragResult.ok) {
    spanRecorder.push({
      tool: 'retrieve_attractions',
      ok: false,
      ms: ragMs,
      errorCode: ragResult.error.code,
    });
    hooks?.onToolEnd?.('retrieve_attractions', false, ragMs);
    throw new Error(ragResult.error.message);
  }
  const ragCandidates = ragResult.data.candidates;
  spanRecorder.push({
    tool: 'retrieve_attractions',
    ok: true,
    ms: ragMs,
    ragMatchedIds: ragResult.data.matchedIds,
    ragScoreSummary: ragResult.data.ragScoreSummary,
    inputDigest: digestWorkflowPayload({
      city: resolvePlanningCity(intent),
      themes: intent.themes,
    }),
    outputDigest: digestWorkflowPayload({ count: ragCandidates.length }),
  });
  hooks?.onToolEnd?.('retrieve_attractions', true, ragMs);

  hooks?.onToolStart?.('build_route_variants');
  const variantStart = Date.now();
  const variantResult = await runBuildRouteVariantsTool({
    intent,
    locale,
    userId: request.userId,
    candidateCount: templateNodeConfig.skipVariants ? 1 : templateNodeConfig.variantCount,
  });
  const variantMs = Date.now() - variantStart;
  if (!variantResult.ok) {
    trace.push({ tool: 'build_route_variants', ok: false, ms: variantMs });
    hooks?.onToolEnd?.('build_route_variants', false, variantMs);
    throw new Error(variantResult.error.message);
  }
  trace.push({ tool: 'build_route_variants', ok: true, ms: variantMs });
  hooks?.onToolEnd?.('build_route_variants', true, variantMs);

  const variants = variantResult.data.variants as Array<{
    key: string;
    label: string;
    hint: string;
    sortOrder: number;
  }>;
  const candidates: AgentPlanCandidateDraft[] = [];

  for (const variant of variants) {
    const genStart = Date.now();
    hooks?.onToolStart?.('generate_route_draft');
    const result = await generateRoute(
      {
        prompt: request.prompt,
        history: request.history,
        days: request.days,
        budget: request.budget,
        provider: request.provider as 'auto' | 'douxing' | 'deepseek' | 'lmstudio' | undefined,
        locale,
        intent,
        userId: request.userId,
        sessionId: request.sessionId,
        ragCandidates,
        variantKey: variant.key,
        variantHint: variant.hint,
        ragVariantIndex: variant.sortOrder,
        excludePoiNames: context.excludePoiNames,
        boostPoiNames: context.boostPoiNames,
      },
      { draftOnly: true },
    );
    const genMs = Date.now() - genStart;
    spanRecorder.push({
      tool: 'generate_route_draft',
      ok: true,
      ms: genMs,
      llmUsage: result.llmUsage,
      inputDigest: digestWorkflowPayload({ variantKey: variant.key }),
    });
    hooks?.onToolEnd?.('generate_route_draft', true, genMs);

    const finalized = await finalizeDraftWithEnrich(
      result,
      intent,
      locale,
      trace,
      hooks,
      templateNodeConfig,
    );
    candidates.push({
      draft: { ...finalized, generationSource: 'llm', intent: result.intent ?? intent },
      variantKey: variant.key,
      label: variant.label,
      sortOrder: variant.sortOrder,
    });
  }

  const primary = candidates[0];
  if (!primary) {
    throw new Error('PLAN_GENERATE_EMPTY');
  }

  return {
    draft: primary.draft,
    candidates,
    toolTrace: trace,
    routedIntent,
  };
}



async function callRemoteAgentPlan(

  request: AgentPlanRequest,

): Promise<AgentPlanResult | null> {

  const baseUrl = getAiServiceBaseUrl().replace(/\/$/, '');

  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), getAgentPlanTimeoutMs());



  try {

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (request.graphDefOverride) {
      headers['X-Workflow-Engine'] = 'template';
    }

    const res = await fetch(`${baseUrl}/v1/agent/plan`, {

      method: 'POST',

      headers,

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



/**
 * 调用 Python Agent SSE 流式规划接口，实时触发 hooks（方案 1：astream_events）。
 *
 * @param request - Agent 规划请求
 * @param hooks - Tool 开始/结束回调
 * @returns 规划结果；流失败或 error 事件时 null
 */
async function callRemoteAgentPlanStream(
  request: AgentPlanRequest,
  hooks: AgentPlanStreamHooks,
): Promise<AgentPlanResult | null> {
  const baseUrl = getAiServiceBaseUrl().replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getAgentPlanTimeoutMs());

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (request.graphDefOverride) {
      headers['X-Workflow-Engine'] = 'template';
    }

    const res = await fetch(`${baseUrl}/v1/agent/plan/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: AgentPlanResult | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, remaining } = consumeSseBuffer(buffer);
      buffer = remaining;

      for (const event of events) {
        if (event.event === 'tool_call') {
          let payload: PlanSessionStreamToolCallPayload | null = null;
          try {
            payload = JSON.parse(event.data) as PlanSessionStreamToolCallPayload;
          } catch {
            payload = null;
          }
          if (!payload?.tool || !payload.status) continue;

          if (payload.status === 'running') {
            hooks.onToolStart?.(payload.tool);
          } else {
            const span: AgentToolTraceEntry = {
              tool: payload.tool,
              ok: payload.status === 'done',
              ms: payload.ms ?? 0,
              nodeId: payload.nodeId,
              inputDigest: payload.inputDigest,
              outputDigest: payload.outputDigest,
            };
            hooks.onToolEnd?.(payload.tool, payload.status === 'done', payload.ms ?? 0, span);
          }
          continue;
        }

        if (event.event === 'done') {
          try {
            result = JSON.parse(event.data) as AgentPlanResult;
          } catch {
            result = null;
          }
          continue;
        }

        if (event.event === 'error') {
          return null;
        }
      }
    }

    return result;
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

function replayAgentToolTrace(
  trace: AgentToolTraceEntry[],
  hooks?: AgentPlanStreamHooks,
  skipTools: ReadonlySet<string> = new Set(['parse_intent']),
): void {
  if (!hooks || trace.length === 0) return;
  for (const entry of trace) {
    if (skipTools.has(entry.tool)) continue;
    hooks.onToolStart?.(entry.tool);
    hooks.onToolEnd?.(entry.tool, entry.ok, entry.ms, entry);
  }
}



interface MemoryAgentStepResult {

  intent?: TravelIntentSnapshot;

  memorySummary?: string;

  recallExplain?: MemoryRecallExplainItem[];

  memories?: AgentPlanResult['memories'];

}



async function runMemoryAgentStep(

  request: AgentPlanRequest,

  trace: AgentPlanResult['toolTrace'],

  hooks?: AgentPlanStreamHooks,

): Promise<MemoryAgentStepResult> {

  const locale = request.locale ?? 'zh-CN';

  const memStart = Date.now();

  hooks?.onToolStart?.('memory_agent');

  const recall = await runRecallUserMemoryTool({

    userId: request.userId,

    limit: 8,

    query: request.prompt.slice(0, 120),

    locale,

  });

  const memMs = Date.now() - memStart;

  trace.push({ tool: 'memory_agent', ok: recall.ok, ms: memMs });

  hooks?.onToolEnd?.('memory_agent', recall.ok, memMs);



  if (!recall.ok) {

    return { intent: request.intent };

  }



  const memorySummary = recall.data.memorySummary as string | undefined;

  const recallExplain = recall.data.recallExplain as MemoryRecallExplainItem[] | undefined;

  const memories = recall.data.memories as AgentPlanResult['memories'];

  const context = recall.data.context as

    | {

        memoryThemes?: string[];

        excludePoiNames?: string[];

        boostPoiNames?: string[];

      }

    | undefined;



  if (!request.intent) {

    return { intent: request.intent, memorySummary, recallExplain, memories };

  }



  const applyStart = Date.now();

  hooks?.onToolStart?.('apply_memory_context');

  const applied = await runApplyMemoryContextTool({

    intent: request.intent,

    userId: request.userId,

    memorySummary,

    context,

  });

  const applyMs = Date.now() - applyStart;

  trace.push({ tool: 'apply_memory_context', ok: applied.ok, ms: applyMs });

  hooks?.onToolEnd?.('apply_memory_context', applied.ok, applyMs);



  return {

    intent: applied.ok

      ? (applied.data.intent as TravelIntentSnapshot)

      : request.intent,

    memorySummary,

    recallExplain,

    memories,

  };

}



async function runLocalAgentPlan(
  request: AgentPlanRequest,
  hooks?: AgentPlanStreamHooks,
): Promise<AgentPlanResult> {

  const trace: AgentPlanResult['toolTrace'] = [];

  const routed = routeAgentIntent(request.prompt);

  const memoryStep = await runMemoryAgentStep(request, trace, hooks);

  const intent = memoryStep.intent;

  const locale = request.locale;

  const draft = request.currentDraft;

  const memoryMeta = {

    memories: memoryStep.memories,

    memorySummary: memoryStep.memorySummary,

    recallExplain: memoryStep.recallExplain,

  };



  if (routed.route === 'select_variant' && request.sessionId) {

    const t0 = Date.now();

    hooks?.onToolStart?.('select_plan_variant');

    const selected = await resolvePlanVariantSelection(

      request.sessionId,

      request.userId,

      request.prompt,

      locale,

    );

    const ms = Date.now() - t0;

    trace.push({ tool: 'select_plan_variant', ok: !!selected, ms });

    hooks?.onToolEnd?.('select_plan_variant', !!selected, ms);

    if (selected) {

      return {

        toolTrace: trace,

        routedIntent: routed.route,

        selectedRouteId: selected.routeId,

        assistantMessage: selected.assistantMessage,

        ...memoryMeta,

      };

    }

  }



  if (routed.route === 'qa_food' && intent) {

    const t0 = Date.now();

    hooks?.onToolStart?.('answer_food_qa');

    const assistantMessage = await answerFoodQa({

      intent,

      prompt: request.prompt,

      locale,

      userId: request.userId,

    });

    const ms = Date.now() - t0;

    trace.push({ tool: 'answer_food_qa', ok: true, ms });

    hooks?.onToolEnd?.('answer_food_qa', true, ms);

    return {

      toolTrace: trace,

      routedIntent: routed.route,

      assistantMessage,

      ...memoryMeta,

    };

  }



  if (draft && intent) {

    const patchDayIndex = resolvePatchDayIndex(draft, routed);

    if (

      (routed.route === 'tweak_day' || routed.route === 'tweak_poi') &&

      patchDayIndex != null

    ) {

      const t0 = Date.now();

      hooks?.onToolStart?.('patch_route_day');

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

      const patchMs = Date.now() - t0;

      trace.push({ tool: 'patch_route_day', ok: true, ms: patchMs });

      hooks?.onToolEnd?.('patch_route_day', true, patchMs);

      const finalized = await finalizeDraftWithEnrich(patched, intent, locale, trace, hooks);

      return {

        draft: { ...finalized, generationSource: 'llm', intent },

        toolTrace: trace,

        routedIntent: routed.route,

        assistantHint: '已局部调整指定天行程',

        ...memoryMeta,

      };

    }



    if (routed.route === 'budget_tune') {

      const t0 = Date.now();

      hooks?.onToolStart?.('tune_route_budget');

      const tuned = tuneRouteBudget({ draft, intent, locale });

      const tuneMs = Date.now() - t0;

      trace.push({ tool: 'tune_route_budget', ok: true, ms: tuneMs });

      hooks?.onToolEnd?.('tune_route_budget', true, tuneMs);

      const finalized = await finalizeDraftWithEnrich(tuned, intent, locale, trace, hooks);

      return {

        draft: { ...finalized, generationSource: 'llm', intent },

        toolTrace: trace,

        routedIntent: routed.route,

        assistantHint: buildBudgetTunedAssistantHint(locale ?? 'zh-CN'),

        ...memoryMeta,

      };

    }



    if (routed.route === 'lodging_tune') {

      hooks?.onToolStart?.('lodging_tune');

      trace.push({ tool: 'lodging_tune', ok: true, ms: 0 });

      hooks?.onToolEnd?.('lodging_tune', true, 0);

      const finalized = await finalizeDraftWithEnrich(draft, intent, locale, trace, hooks);

      return {

        draft: { ...finalized, generationSource: 'llm', intent },

        toolTrace: trace,

        routedIntent: routed.route,

        assistantHint: buildLodgingTunedAssistantHint(locale ?? 'zh-CN'),

        ...memoryMeta,

      };

    }

  }



  const context = await loadPlanUserContext(request.userId);

  if (!draft && intent) {
    const result = await generatePlanNewCandidates(request, intent, routed.route, trace, hooks);
    return { ...result, ...memoryMeta };
  }

  const genStart = Date.now();

  hooks?.onToolStart?.('generate_route_draft');

  const result = await generateRoute({

    prompt: request.prompt,

    history: request.history,

    days: request.days,

    budget: request.budget,

    provider: request.provider as 'auto' | 'douxing' | 'deepseek' | 'lmstudio' | undefined,

    locale,

    intent,

    userId: request.userId,

    excludePoiNames: context.excludePoiNames,

    boostPoiNames: context.boostPoiNames,

  });

  const genMs = Date.now() - genStart;

  const spanRecorder = new WorkflowNodeSpanRecorder(trace);
  spanRecorder.push({
    tool: 'generate_route_draft',
    ok: true,
    ms: genMs,
    llmUsage: result.llmUsage,
  });

  hooks?.onToolEnd?.('generate_route_draft', true, genMs);



  return {

    draft: result,

    toolTrace: trace,

    routedIntent: routed.route,

    ...memoryMeta,

  };

}



export async function runAgentPlan(

  request: AgentPlanRequest,

  hooks?: AgentPlanStreamHooks,

): Promise<AgentPlanResult | null> {

  if (!isAgentPlanEnabled()) return null;

  const normalized: AgentPlanRequest = {
    ...request,
    provider: request.provider ?? getAgentPlanDefaultProvider(),
  };

  if (hooks) {
    const streamed = await callRemoteAgentPlanStream(normalized, hooks);
    if (isAgentPlanResultUsable(streamed)) return streamed;
  }

  const remote = await callRemoteAgentPlan(normalized);

  if (isAgentPlanResultUsable(remote)) {

    replayAgentToolTrace(remote.toolTrace ?? [], hooks);

    return remote;

  }



  const local = await runLocalAgentPlan(normalized, hooks);

  if (isAgentPlanResultUsable(local)) return local;

  return null;

}



export { isAgentPlanEnabled };


