import type { ApiResponse } from '@douxing/shared';
import { ApiMessageKey, resolveApiMessage, resolveClientRequestErrorMessage } from '@douxing/shared';
import { getApiAcceptLanguage } from './api-locale-header';
import { i18n } from '@/i18n';
import { getApiBaseUrl } from './api-base';
import { getStoredToken, setAuth, getStoredUser, TOKEN_KEY } from './auth-storage';
import {
  handleUnauthorizedAfterRefreshFailed,
  isAccessTokenExpiredResponse,
  setUnauthorizedHandler,
  tryRefreshAccessToken,
} from './auth-refresh';
import {
  beginAiPlanLoading,
  endAiPlanLoading,
  registerAiPlanRequestTask,
  isRequestAbortedError,
  getAiPlanCancelledMessage,
  applyAiPlanResponseTrace,
  beginPlanSessionStream,
} from './ai-plan-loading';

/** 封装请求选项（url 由 path 拼接，无需传入） */
export type AppRequestOptions = Omit<UniApp.RequestOptions, 'url'>;

export { getStoredUser, setAuth, TOKEN_KEY, setUnauthorizedHandler };

/** 将 catch 到的错误转为可展示的用户文案（过滤 request:fail 等系统信息） */
export function getAppErrorMessage(err: unknown, fallback: string): string {
  const locale = getApiAcceptLanguage();
  if (typeof err === 'string') {
    return resolveClientRequestErrorMessage(err, locale) || fallback;
  }
  if (!(err instanceof Error)) return fallback;
  if (isRequestAbortedError(err.message)) return getAiPlanCancelledMessage();
  if (err.message === getAiPlanCancelledMessage()) return err.message;
  return resolveClientRequestErrorMessage(err.message, locale) || fallback;
}

function resolveApiErrorMessage(body: ApiResponse<unknown>): string {
  if (body.message?.trim()) return body.message;
  if (body.messageKey) {
    return resolveApiMessage(body.messageKey, getApiAcceptLanguage());
  }
  return resolveApiMessage(ApiMessageKey.REQUEST_FAILED, getApiAcceptLanguage());
}

function buildRequestUrl(path: string): string {
  const base = getApiBaseUrl();
  return path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function isAuthLoginPath(url: string): boolean {
  return /\/auth\/(login|register|sms\/login)(?:\?|$)/.test(url);
}

function isAuthRefreshPath(url: string): boolean {
  return /\/auth\/refresh(?:\?|$)/.test(url);
}

interface UniRequestResult {
  statusCode: number;
  data: unknown;
}

/**
 * 发起 uni.request 并返回 Promise。
 *
 * @param url - 完整请求 URL
 * @param options - uni.request 选项
 * @param trackForAbort - 是否注册 AI 规划 abort 任务
 * @returns HTTP 响应摘要
 */
function uniRequestAsync(
  url: string,
  options: AppRequestOptions,
  trackForAbort: boolean,
): Promise<UniRequestResult> {
  const token = getStoredToken();

  return new Promise((resolve, reject) => {
    const task = uni.request({
      url,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout ?? 15000,
      header: {
        'Content-Type': 'application/json',
        'Accept-Language': getApiAcceptLanguage(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.header,
      },
      success: (res) => {
        resolve({
          statusCode: res.statusCode ?? 0,
          data: res.data,
        });
      },
      fail: (err) => {
        if (trackForAbort && isRequestAbortedError(err.errMsg)) {
          reject(new Error(getAiPlanCancelledMessage()));
          return;
        }
        const raw =
          err.errMsg ||
          (typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message?: unknown }).message ?? '')
            : '');
        reject(new Error(resolveClientRequestErrorMessage(raw, getApiAcceptLanguage())));
      },
    });
    if (trackForAbort) {
      registerAiPlanRequestTask(task);
    }
  });
}

/**
 * 解析 API 响应；Access Token 过期时尝试无感 refresh 并重试一次。
 *
 * @param url - 完整请求 URL
 * @param options - 请求选项
 * @param trackForAbort - 是否注册 abort
 * @param isRetry - 是否为 refresh 后的重试
 * @returns 业务 data 字段
 */
async function runRequest<T>(
  url: string,
  options: AppRequestOptions,
  trackForAbort = false,
  isRetry = false,
): Promise<T> {
  const res = await uniRequestAsync(url, options, trackForAbort);
  const body = res.data as ApiResponse<T>;

  if (
    !isRetry &&
    !isAuthLoginPath(url) &&
    !isAuthRefreshPath(url) &&
    getStoredToken() &&
    isAccessTokenExpiredResponse(res.statusCode, body)
  ) {
    const newToken = await tryRefreshAccessToken();
    if (newToken) {
      return runRequest<T>(url, options, trackForAbort, true);
    }
    throw new Error(handleUnauthorizedAfterRefreshFailed(resolveApiErrorMessage(body)));
  }

  if (body && typeof body === 'object' && 'code' in body) {
    if (body.code === 0) {
      return body.data;
    }
    throw new Error(resolveApiErrorMessage(body));
  }

  throw new Error(resolveApiMessage(ApiMessageKey.RESPONSE_FORMAT_ERROR, getApiAcceptLanguage()));
}

export function request<T>(path: string, options: AppRequestOptions = {}): Promise<T> {
  return runRequest<T>(buildRequestUrl(path), options);
}

export interface RequestAiPlanOptions extends AppRequestOptions {
  /** @deprecated 请使用 loadingMessageKey */
  loadingMessage?: string;
  /** i18n 键，如 plan.aiPlanningMulti */
  loadingMessageKey?: string;
  /** 追问时传入，用于订阅 SSE Tool 进度 */
  sessionId?: number;
}

function resolveAiPlanLoadingMessage(options: RequestAiPlanOptions): string | undefined {
  if (options.loadingMessageKey) {
    return String(i18n.global.t(options.loadingMessageKey));
  }
  return options.loadingMessage;
}

/** AI 路线生成/重新生成：全局遮罩 + 可 abort */
export function requestAiPlan<T>(path: string, options: RequestAiPlanOptions = {}): Promise<T> {
  const loadingMessage = resolveAiPlanLoadingMessage(options);
  if (loadingMessage) {
    beginAiPlanLoading(loadingMessage);
  } else {
    beginAiPlanLoading();
  }

  if (options.sessionId) {
    beginPlanSessionStream(options.sessionId);
  }

  const {
    loadingMessage: _msg,
    loadingMessageKey: _key,
    sessionId: _sessionId,
    ...requestOptions
  } = options;
  const url = buildRequestUrl(path);

  return runRequest<T>(url, requestOptions, true)
    .then((data) => {
      applyAiPlanResponseTrace(data);
      return data;
    })
    .finally(() => {
      endAiPlanLoading();
    });
}
