/**
 * Phase 1/3：调用 Python Agent 或本地 Agent 路径
 */
import type { LocaleCode, PlanChatMessage, TravelIntentSnapshot } from '@douxing/shared';
import {
  getAgentPlanTimeoutMs,
  getAiServiceBaseUrl,
  isAgentPlanEnabled,
} from '../config/agent.js';
import type { GeneratedRouteDraft } from './route-generator.service.js';
import { routeAgentIntent } from './agent-intent-router.service.js';
import { patchRouteDay } from './patch-route-day.service.js';
import { generateRoute } from './route-generator.service.js';
import { loadPlanUserContext } from './plan-user-context.service.js';

export interface AgentPlanRequest {
  prompt: string;
  userId: number;
  history?: PlanChatMessage[];
  days?: number;
  budget?: string;
  locale?: LocaleCode;
  provider?: string;
  currentDraft?: GeneratedRouteDraft;
  intent?: TravelIntentSnapshot;
}

export interface AgentPlanResult {
  draft: GeneratedRouteDraft & { generationSource?: string; intent?: TravelIntentSnapshot };
  toolTrace: Array<{ tool: string; ok: boolean; ms: number }>;
  routedIntent: string;
  assistantHint?: string;
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

async function runLocalAgentPlan(request: AgentPlanRequest): Promise<AgentPlanResult> {
  const trace: AgentPlanResult['toolTrace'] = [];
  const routed = routeAgentIntent(request.prompt);
  const context = await loadPlanUserContext(request.userId);
  const t0 = Date.now();

  if (
    request.currentDraft &&
    (routed.route === 'tweak_day' || routed.route === 'tweak_poi') &&
    routed.dayIndex != null
  ) {
    const draft = await patchRouteDay({
      draft: request.currentDraft,
      dayIndex: routed.dayIndex,
      intent: request.intent ?? request.currentDraft as unknown as TravelIntentSnapshot,
      locale: request.locale,
      relaxed: routed.relaxed,
      excludeNames: routed.excludePoiNames,
      prompt: request.prompt,
    });
    trace.push({ tool: 'patch_route_day', ok: true, ms: Date.now() - t0 });
    return {
      draft: { ...draft, generationSource: 'llm', intent: request.intent },
      toolTrace: trace,
      routedIntent: routed.route,
      assistantHint: '已局部调整指定天行程',
    };
  }

  const genStart = Date.now();
  const result = await generateRoute({
    prompt: request.prompt,
    history: request.history,
    days: request.days,
    budget: request.budget,
    provider: request.provider as 'auto' | 'deepseek' | 'lmstudio' | undefined,
    locale: request.locale,
    intent: request.intent,
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
  if (remote?.draft) return remote;

  return runLocalAgentPlan(request);
}

export { isAgentPlanEnabled };
