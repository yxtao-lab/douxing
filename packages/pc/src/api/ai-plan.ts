import { ref } from 'vue';
import axios from 'axios';
import type { ApiResponse } from '@douxing/shared';
import http from './http';
import { i18n } from '@/i18n';

const AI_PLAN_TIMEOUT_MS = 120_000;

export const aiPlanLoading = ref(false);
export const aiPlanMessage = ref('');

let abortController: AbortController | null = null;

export function cancelAiPlanRequest() {
  abortController?.abort();
  abortController = null;
  aiPlanLoading.value = false;
}

export function isAiPlanCancelledError(err: unknown): boolean {
  if (!axios.isCancel(err)) return false;
  return true;
}

interface RequestAiPlanOptions {
  method?: 'POST' | 'PUT';
  data?: unknown;
  loadingMessageKey?: string;
}

export async function requestAiPlan<T>(path: string, options: RequestAiPlanOptions = {}): Promise<T> {
  cancelAiPlanRequest();
  abortController = new AbortController();

  aiPlanLoading.value = true;
  aiPlanMessage.value = options.loadingMessageKey
    ? String(i18n.global.t(options.loadingMessageKey))
    : String(i18n.global.t('plan.aiPlanning'));

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

    return response.data.data;
  } catch (err) {
    if (axios.isCancel(err)) {
      throw new Error(String(i18n.global.t('plan.cancelled')));
    }
    throw err;
  } finally {
    aiPlanLoading.value = false;
    abortController = null;
  }
}
