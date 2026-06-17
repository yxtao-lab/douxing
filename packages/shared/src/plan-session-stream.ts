import type {
  PlanSessionStreamAssistantPayload,
  PlanSessionStreamDonePayload,
  PlanSessionStreamErrorPayload,
  PlanSessionStreamToolCallPayload,
} from './types.js';
import type { AgentToolStepView } from './i18n/agent-status-messages.js';

export interface ParsedSseEvent {
  event: string;
  data: string;
}

/** 从 SSE 文本缓冲中解析完整事件块 */
export function consumeSseBuffer(buffer: string): { events: ParsedSseEvent[]; remaining: string } {
  const events: ParsedSseEvent[] = [];
  const parts = buffer.split('\n\n');
  const remaining = parts.pop() ?? '';

  for (const block of parts) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith(':')) continue;

    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of trimmed.split('\n')) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }
    if (dataLines.length > 0) {
      events.push({ event: eventName, data: dataLines.join('\n') });
    }
  }

  return { events, remaining };
}

/** 将 SSE `tool_call` 合并进步骤列表（不可变） */
export function applyPlanSessionToolCallStep(
  steps: AgentToolStepView[],
  payload: PlanSessionStreamToolCallPayload,
): AgentToolStepView[] {
  const status: AgentToolStepView['status'] =
    payload.status === 'running'
      ? 'running'
      : payload.status === 'done'
        ? 'done'
        : 'failed';

  const next = [...steps];
  const thinkingIdx = next.findIndex((step) => step.tool === 'thinking' && step.status === 'running');
  if (thinkingIdx >= 0 && payload.tool !== 'thinking') {
    next.splice(thinkingIdx, 1);
  }

  const existingIdx = next.findIndex((step) => step.tool === payload.tool);
  const merged: AgentToolStepView = {
    tool: payload.tool,
    status,
    ...(payload.ms != null && payload.ms > 0 ? { ms: payload.ms } : {}),
  };

  if (existingIdx >= 0) {
    next[existingIdx] = { ...next[existingIdx], ...merged };
  } else {
    next.push(merged);
  }
  return next;
}

export interface PlanSessionStreamHandlers {
  onToolCall?: (payload: PlanSessionStreamToolCallPayload) => void;
  onAssistant?: (payload: PlanSessionStreamAssistantPayload) => void;
  onDone?: (payload: PlanSessionStreamDonePayload) => void;
  onError?: (payload: PlanSessionStreamErrorPayload) => void;
}

export type PlanSessionStreamTerminal = 'done' | 'error';

function parseJsonData<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 分发单条 SSE 事件；返回 `'done' | 'error'` 表示流应结束 */
export function dispatchPlanSessionStreamEvent(
  eventName: string,
  rawData: string,
  handlers: PlanSessionStreamHandlers,
): PlanSessionStreamTerminal | null {
  switch (eventName) {
    case 'tool_call': {
      const payload = parseJsonData<PlanSessionStreamToolCallPayload>(rawData);
      if (payload?.tool && payload.status) handlers.onToolCall?.(payload);
      return null;
    }
    case 'assistant': {
      const payload = parseJsonData<PlanSessionStreamAssistantPayload>(rawData);
      if (payload) handlers.onAssistant?.(payload);
      return null;
    }
    case 'done': {
      const payload = parseJsonData<PlanSessionStreamDonePayload>(rawData);
      if (payload) handlers.onDone?.(payload);
      return 'done';
    }
    case 'error': {
      const payload = parseJsonData<PlanSessionStreamErrorPayload>(rawData);
      if (payload?.messageKey) handlers.onError?.(payload);
      return 'error';
    }
    default:
      return null;
  }
}
