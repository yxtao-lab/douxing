import type { PlanSessionStreamEventName, ApiMessageParams } from '@douxing/shared';

export interface PlanSessionStreamEnvelope {
  event: PlanSessionStreamEventName;
  data: Record<string, unknown>;
}

interface SessionStreamHub {
  buffer: PlanSessionStreamEnvelope[];
  listeners: Set<(envelope: PlanSessionStreamEnvelope) => void>;
  generationActive: boolean;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

const hubs = new Map<number, SessionStreamHub>();

const MAX_BUFFER = 100;
const HUB_CLEANUP_DELAY_MS = 5 * 60 * 1000;

function getHub(sessionId: number): SessionStreamHub {
  let hub = hubs.get(sessionId);
  if (!hub) {
    hub = {
      buffer: [],
      listeners: new Set(),
      generationActive: false,
      cleanupTimer: null,
    };
    hubs.set(sessionId, hub);
  }
  return hub;
}

function clearHubCleanupTimer(hub: SessionStreamHub): void {
  if (hub.cleanupTimer) {
    clearTimeout(hub.cleanupTimer);
    hub.cleanupTimer = null;
  }
}

function scheduleHubCleanup(sessionId: number): void {
  const hub = getHub(sessionId);
  clearHubCleanupTimer(hub);
  hub.cleanupTimer = setTimeout(() => {
    if (!hub.generationActive && hub.listeners.size === 0) {
      hubs.delete(sessionId);
    }
  }, HUB_CLEANUP_DELAY_MS);
}

/** 新一轮规划开始：清空缓冲并标记活跃 */
export function beginPlanSessionGeneration(sessionId: number): void {
  const hub = getHub(sessionId);
  clearHubCleanupTimer(hub);
  hub.generationActive = true;
  hub.buffer = [];
}

export function emitPlanSessionStreamEvent(
  sessionId: number,
  event: PlanSessionStreamEventName,
  data: Record<string, unknown>,
): void {
  const envelope: PlanSessionStreamEnvelope = { event, data };
  const hub = getHub(sessionId);
  hub.buffer.push(envelope);
  if (hub.buffer.length > MAX_BUFFER) {
    hub.buffer.shift();
  }
  for (const listener of hub.listeners) {
    listener(envelope);
  }
}

export function emitPlanSessionToolCall(
  sessionId: number,
  payload: {
    tool: string;
    status: 'running' | 'done' | 'failed';
    ms?: number;
    nodeId?: string;
    inputDigest?: string;
    outputDigest?: string;
  },
): void {
  emitPlanSessionStreamEvent(sessionId, 'tool_call', payload);
}

/**
 * 推送画布编排节点状态 SSE 事件。
 *
 * @param sessionId - 规划会话 ID
 * @param payload - nodeId、status 及可选 routedIntent
 */
export function emitPlanSessionNodeStatus(
  sessionId: number,
  payload: {
    nodeId: string;
    status: 'running' | 'success' | 'failed';
    routedIntent?: string;
    ms?: number;
  },
): void {
  emitPlanSessionStreamEvent(sessionId, 'node_status', payload);
}

export function emitPlanSessionAssistantFinal(
  sessionId: number,
  final: string,
): void {
  emitPlanSessionStreamEvent(sessionId, 'assistant', { final });
}

export function completePlanSessionStream(
  sessionId: number,
  result: Record<string, unknown>,
): void {
  emitPlanSessionStreamEvent(sessionId, 'done', { result });
  const hub = getHub(sessionId);
  hub.generationActive = false;
  scheduleHubCleanup(sessionId);
}

export function failPlanSessionStream(
  sessionId: number,
  messageKey: string,
  params?: ApiMessageParams,
): void {
  emitPlanSessionStreamEvent(sessionId, 'error', {
    messageKey,
    ...(params ? { params } : {}),
  });
  const hub = getHub(sessionId);
  hub.generationActive = false;
  scheduleHubCleanup(sessionId);
}

export function subscribePlanSessionStream(
  sessionId: number,
  listener: (envelope: PlanSessionStreamEnvelope) => void,
): () => void {
  const hub = getHub(sessionId);
  clearHubCleanupTimer(hub);
  hub.listeners.add(listener);
  return () => {
    hub.listeners.delete(listener);
    if (!hub.generationActive && hub.listeners.size === 0) {
      scheduleHubCleanup(sessionId);
    }
  };
}

export function getPlanSessionStreamBuffer(sessionId: number): PlanSessionStreamEnvelope[] {
  return [...getHub(sessionId).buffer];
}

export function isPlanSessionGenerationActive(sessionId: number): boolean {
  return getHub(sessionId).generationActive;
}

/** 包装单次 Tool 调用并推送 SSE */
export async function runPlanSessionTrackedTool<T>(
  sessionId: number,
  tool: string,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  emitPlanSessionToolCall(sessionId, { tool, status: 'running' });
  try {
    const result = await fn();
    emitPlanSessionToolCall(sessionId, {
      tool,
      status: 'done',
      ms: Date.now() - startedAt,
    });
    return result;
  } catch (err) {
    emitPlanSessionToolCall(sessionId, {
      tool,
      status: 'failed',
      ms: Date.now() - startedAt,
    });
    throw err;
  }
}
