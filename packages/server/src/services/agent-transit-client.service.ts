import type {
  AgentToolTraceEntry,
  LocaleCode,
  RouteReplanSegmentPayload,
} from '@douxing/shared';
import { ApiMessageKey } from '@douxing/shared';
import { ApiError } from '@douxing/shared';
import { canUseAiService, getAiServiceBaseUrl, getAiServiceTimeoutMs } from '../config/ai-service.js';
import type { ReplanSegmentContext, ReplanSegmentResult } from './replan-segment.service.js';

interface AiTransitAgentResponse extends RouteReplanSegmentPayload {
  toolTrace?: AgentToolTraceEntry[];
}

async function fetchTransitAgent(payload: {
  routeId: number;
  userId: number;
  locale: LocaleCode;
  context: ReplanSegmentContext;
}): Promise<AiTransitAgentResponse> {
  const baseUrl = getAiServiceBaseUrl();
  const timeoutMs = getAiServiceTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/v1/agent/transit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = (await res.json()) as AiTransitAgentResponse & { detail?: string };
    if (!res.ok) {
      throw new Error(typeof data.detail === 'string' ? data.detail : `HTTP ${res.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function mapTransitResponse(data: AiTransitAgentResponse): ReplanSegmentResult {
  return {
    routeId: data.routeId,
    dayIndex: data.dayIndex,
    day: data.day,
    segment: data.segment,
    diff: data.diff,
  };
}

export async function previewReplanViaTransitAgent(input: {
  routeId: number;
  userId: number;
  locale: LocaleCode;
  context: ReplanSegmentContext;
}): Promise<{ preview: ReplanSegmentResult; toolTrace: AgentToolTraceEntry[] }> {
  if (!canUseAiService()) {
    throw new ApiError(ApiMessageKey.AI_SERVICE_DISABLED);
  }

  const data = await fetchTransitAgent(input);
  return {
    preview: mapTransitResponse(data),
    toolTrace: data.toolTrace ?? [{ tool: 'transit_agent', ok: true, ms: 0 }],
  };
}
