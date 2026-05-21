import { reactive, readonly } from 'vue';

export const AI_PLAN_CANCELLED_MESSAGE = '已取消路线规划';

const state = reactive({
  active: false,
  message: 'AI 正在规划路线…',
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
    uni.showToast({ title: '路线规划进行中，请等待完成或取消', icon: 'none' });
    return false;
  };

  const methods = ['navigateTo', 'redirectTo', 'switchTab', 'reLaunch', 'navigateBack'] as const;
  for (const method of methods) {
    uni.addInterceptor(method, { invoke: blockNavigation });
  }
}

export function beginAiPlanLoading(message = 'AI 正在规划路线…') {
  installNavigationInterceptors();
  state.message = message;
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
