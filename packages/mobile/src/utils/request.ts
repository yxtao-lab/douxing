import type { ApiResponse } from '@douxing/shared';
import { getApiBaseUrl } from './api-base';
import { getStoredToken, setAuth, getStoredUser, TOKEN_KEY } from './auth-storage';
import {
  beginAiPlanLoading,
  endAiPlanLoading,
  registerAiPlanRequestTask,
  isRequestAbortedError,
  AI_PLAN_CANCELLED_MESSAGE,
} from './ai-plan-loading';

/** 封装请求选项（url 由 path 拼接，无需传入） */
export type AppRequestOptions = Omit<UniApp.RequestOptions, 'url'>;

export { getStoredUser, setAuth, TOKEN_KEY };

function buildRequestUrl(path: string): string {
  const base = getApiBaseUrl();
  return path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function runRequest<T>(
  url: string,
  options: AppRequestOptions,
  trackForAbort = false,
): Promise<T> {
  const token = getStoredToken();

  return new Promise((resolve, reject) => {
    const task = uni.request({
      url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.header,
      },
      success: (res) => {
        const body = res.data as ApiResponse<T>;
        if (body && typeof body === 'object' && 'code' in body) {
          if (body.code === 0) {
            resolve(body.data);
            return;
          }
          reject(new Error(body.message || '请求失败'));
          return;
        }
        reject(new Error('响应格式错误'));
      },
      fail: (err) => {
        if (trackForAbort && isRequestAbortedError(err.errMsg)) {
          reject(new Error(AI_PLAN_CANCELLED_MESSAGE));
          return;
        }
        reject(new Error(err.errMsg || '网络错误'));
      },
    });
    if (trackForAbort) {
      registerAiPlanRequestTask(task);
    }
  });
}

export function request<T>(path: string, options: AppRequestOptions = {}): Promise<T> {
  return runRequest<T>(buildRequestUrl(path), options);
}

export interface RequestAiPlanOptions extends AppRequestOptions {
  loadingMessage?: string;
}

/** AI 路线生成/重新生成：全局遮罩 + 可 abort */
export function requestAiPlan<T>(path: string, options: RequestAiPlanOptions = {}): Promise<T> {
  if (options.loadingMessage) {
    beginAiPlanLoading(options.loadingMessage);
  } else {
    beginAiPlanLoading();
  }

  const { loadingMessage: _msg, ...requestOptions } = options;
  const url = buildRequestUrl(path);

  return runRequest<T>(url, requestOptions, true).finally(() => {
    endAiPlanLoading();
  });
}
