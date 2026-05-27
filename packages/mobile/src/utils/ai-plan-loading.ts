import { reactive, readonly } from 'vue';
import { i18n } from '@/i18n';

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
});

let activeRequestTask: UniApp.RequestTask | null = null;
let navInterceptorsInstalled = false;

export const aiPlanLoadingState = readonly(state);

export function isAiPlanLoading(): boolean {
  return state.active;
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
  state.message = message ?? translate('plan.aiPlanning');
  state.active = true;
}

export function endAiPlanLoading() {
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
  endAiPlanLoading();
}

export function isRequestAbortedError(errMsg?: string): boolean {
  if (!errMsg) return false;
  const lower = errMsg.toLowerCase();
  return lower.includes('abort') || lower.includes('cancel');
}
