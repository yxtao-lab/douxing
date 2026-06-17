import { reactive, readonly } from 'vue';
import type {
  AgentToolTraceEntry,
  PlanSessionActionResult,
  PlanSessionStreamToolCallPayload,
} from '@douxing/shared';
import {
  applyPlanSessionToolCallStep,
  mapAgentToolTraceToSteps,
  type AgentToolStepView,
} from '@douxing/shared';
import { i18n } from '@/i18n';
import { getApiAcceptLanguage } from './api-locale-header';
import { getApiBaseUrl } from './api-base';
import { getStoredToken } from './auth-storage';
import { startPlanSessionStreamSubscription } from './plan-session-stream';

export const AI_PLAN_CANCELLED_KEY = 'plan.cancelled';

function translate(key: string): string {
  return String(i18n.global.t(key));
}

export function getAiPlanCancelledMessage(): string {
  return translate(AI_PLAN_CANCELLED_KEY);
}

export function isAiPlanCancelledError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (isRequestAbortedError(err.message)) return true;
  const msg = err.message;
  return msg === getAiPlanCancelledMessage();
}

const state = reactive({
  active: false,
  message: '',
  toolSteps: [] as AgentToolStepView[],
  streamActive: false,
});

let activeRequestTask: UniApp.RequestTask | null = null;
let closePlanStream: (() => void) | null = null;
let navInterceptorsInstalled = false;

export const aiPlanLoadingState = readonly(state);

export function isAiPlanLoading(): boolean {
  return state.active;
}

function resetAiPlanToolSteps() {
  state.toolSteps = [];
  state.streamActive = false;
}

export function beginAiPlanToolSteps() {
  resetAiPlanToolSteps();
  state.toolSteps = [{ tool: 'thinking', status: 'running' }];
}

export function applyPlanSessionToolCallPayload(payload: PlanSessionStreamToolCallPayload) {
  state.streamActive = true;
  state.toolSteps = applyPlanSessionToolCallStep(state.toolSteps, payload);
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
  state.toolSteps = mapAgentToolTraceToSteps(trace);
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

export function beginPlanSessionStream(sessionId: number) {
  const token = getStoredToken();
  if (!token) return;

  stopPlanStream();
  closePlanStream = startPlanSessionStreamSubscription({
    sessionId,
    apiBaseUrl: getApiBaseUrl(),
    token,
    locale: getApiAcceptLanguage(),
    handlers: {
      onToolCall: (payload) => applyPlanSessionToolCallPayload(payload),
    },
  });
}

function installNavigationInterceptors() {
  if (navInterceptorsInstalled) return;
  navInterceptorsInstalled = true;

  const blockNavigation = () => {
    if (!state.active) return;
    uni.showToast({ title: translate('plan.aiPlanningNavBlocked'), icon: 'none' });
    return false;
  };

  const methods = ['navigateTo', 'redirectTo', 'switchTab', 'reLaunch', 'navigateBack'] as const;
  for (const method of methods) {
    uni.addInterceptor(method, { invoke: blockNavigation });
  }
}

export function beginAiPlanLoading(message?: string) {
  installNavigationInterceptors();
  beginAiPlanToolSteps();
  state.message = message ?? translate('plan.aiPlanning');
  state.active = true;
}

export function endAiPlanLoading() {
  stopPlanStream();
  state.active = false;
  activeRequestTask = null;
}

export function registerAiPlanRequestTask(task: UniApp.RequestTask) {
  activeRequestTask = task;
}

export function cancelAiPlanLoading() {
  if (activeRequestTask) {
    try {
      activeRequestTask.abort();
    } catch {
      /* 部分平台 abort 可能抛错，忽略 */
    }
  }
  stopPlanStream();
  resetAiPlanToolSteps();
  endAiPlanLoading();
}

export function isRequestAbortedError(errMsg?: string): boolean {
  if (!errMsg) return false;
  const lower = errMsg.toLowerCase();
  return lower.includes('abort') || lower.includes('cancel');
}

export function applyAiPlanResponseTrace(data: unknown) {
  if (state.streamActive) return;
  const trace = extractAgentToolTrace(data);
  if (trace) applyAgentToolTrace(trace);
}
