import { ref } from 'vue';
import axios from 'axios';
import type {
  AgentToolTraceEntry,
  ApiResponse,
  PlanSessionActionResult,
  PlanSessionStreamToolCallPayload,
} from '@douxing/shared';
import {
  applyPlanSessionToolCallStep,
  AUTH_TOKEN_KEY,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  mapAgentToolTraceToSteps,
  isLocaleCode,
  type AgentToolStepView,
  type LocaleCode,
} from '@douxing/shared';
import http from './http';
import { i18n } from '@/i18n';
import { startPlanSessionStreamSubscription } from './plan-session-stream';

const AI_PLAN_TIMEOUT_MS = 120_000;

export const aiPlanLoading = ref(false);
export const aiPlanMessage = ref('');
export const aiPlanToolSteps = ref<AgentToolStepView[]>([]);
/** SSE 是否已收到至少一条 tool_call（用于决定是否用 POST 响应降级） */
export const aiPlanStreamActive = ref(false);

let abortController: AbortController | null = null;
let closePlanStream: (() => void) | null = null;

function getApiAcceptLanguage(): LocaleCode {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocaleCode(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

function getApiBaseUrl(): string {
  return String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
}

function getStoredToken(): string {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function resetAiPlanToolSteps() {
  aiPlanToolSteps.value = [];
  aiPlanStreamActive.value = false;
}

export function beginAiPlanToolSteps() {
  resetAiPlanToolSteps();
  aiPlanToolSteps.value = [{ tool: 'thinking', status: 'running' }];
}

export function applyPlanSessionToolCallPayload(payload: PlanSessionStreamToolCallPayload) {
  aiPlanStreamActive.value = true;
  aiPlanToolSteps.value = applyPlanSessionToolCallStep(aiPlanToolSteps.value, payload);
}

export function pushAiPlanToolStep(
  tool: string,
  status: AgentToolStepView['status'] = 'running',
  ms?: number,
) {
  applyPlanSessionToolCallPayload({
    tool,
    status: status === 'running' ? 'running' : status === 'done' ? 'done' : 'failed',
    ms,
  });
}

export function applyAgentToolTrace(trace: AgentToolTraceEntry[] | undefined | null) {
  if (!trace?.length) return;
  aiPlanToolSteps.value = mapAgentToolTraceToSteps(trace);
}

function extractAgentToolTrace(data: unknown): AgentToolTraceEntry[] | null {
  if (!data || typeof data !== 'object') return null;
  const agentState = (data as PlanSessionActionResult).agentState;
  if (!agentState?.toolTrace?.length) return null;
  return agentState.toolTrace;
}

function stopPlanStream() {
  closePlanStream?.();
  closePlanStream = null;
}

export function cancelAiPlanRequest() {
  abortController?.abort();
  abortController = null;
  stopPlanStream();
  aiPlanLoading.value = false;
  resetAiPlanToolSteps();
}

export function getAiPlanCancelledMessage(): string {
  return String(i18n.global.t('plan.cancelled'));
}

export function isAiPlanCancelledError(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message.trim();
  if (msg === getAiPlanCancelledMessage()) return true;
  const lower = msg.toLowerCase();
  return lower === 'canceled' || lower === 'cancelled' || lower.includes('abort');
}

interface RequestAiPlanOptions {
  method?: 'POST' | 'PUT';
  data?: unknown;
  loadingMessageKey?: string;
  /** 追问时传入，用于订阅 SSE Tool 进度 */
  sessionId?: number;
}

function beginPlanSessionStream(sessionId: number, signal: AbortSignal) {
  const token = getStoredToken();
  if (!token) return;

  stopPlanStream();
  closePlanStream = startPlanSessionStreamSubscription({
    sessionId,
    apiBaseUrl: getApiBaseUrl(),
    token,
    locale: getApiAcceptLanguage(),
    signal,
    handlers: {
      onToolCall: (payload) => applyPlanSessionToolCallPayload(payload),
    },
  });
}

export async function requestAiPlan<T>(path: string, options: RequestAiPlanOptions = {}): Promise<T> {
  cancelAiPlanRequest();
  abortController = new AbortController();

  aiPlanLoading.value = true;
  beginAiPlanToolSteps();
  aiPlanMessage.value = options.loadingMessageKey
    ? String(i18n.global.t(options.loadingMessageKey))
    : String(i18n.global.t('plan.aiPlanning'));

  if (options.sessionId) {
    beginPlanSessionStream(options.sessionId, abortController.signal);
  }

  try {
    const method = options.method ?? 'POST';
    const config = {
      timeout: AI_PLAN_TIMEOUT_MS,
      signal: abortController.signal,
    };

    const response =
      method === 'POST'
        ? await http.post<ApiResponse<T>>(path, options.data, config)
        : await http.put<ApiResponse<T>>(path, options.data, config);

    const data = response.data.data;
    if (!aiPlanStreamActive.value) {
      const trace = extractAgentToolTrace(data);
      if (trace) applyAgentToolTrace(trace);
    }
    return data;
  } catch (err) {
    if (axios.isCancel(err)) {
      throw new Error(getAiPlanCancelledMessage());
    }
    throw err;
  } finally {
    stopPlanStream();
    aiPlanLoading.value = false;
    abortController = null;
  }
}
