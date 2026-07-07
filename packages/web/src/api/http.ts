import axios from 'axios';
import type { ApiResponse } from '@douxing/shared';
import {
  ApiMessageKey,
  LOCALE_STORAGE_KEY,
  DEFAULT_LOCALE,
  isLocaleCode,
  resolveApiMessage,
  resolveClientRequestErrorMessage,
  type LocaleCode,
} from '@douxing/shared';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
});

let unauthorizedHandler: (() => void) | null = null;

/** HTTP 请求错误，保留响应状态码供业务层区分 401/403 等场景。 */
export class ApiRequestError extends Error {
  readonly status?: number;

  /**
   * @param message - 面向用户的错误摘要
   * @param status - HTTP 状态码；网络错误或未响应时为 `undefined`
   */
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

/**
 * 注册全局 401 未授权回调（清会话并跳转登录）。
 *
 * @param handler - 收到带 Authorization 的 401 响应时执行
 */
export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

function getApiAcceptLanguage(): LocaleCode {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocaleCode(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

function resolveApiErrorMessage(body: ApiResponse<unknown>): string {
  if (body.message?.trim()) return body.message;
  if (body.messageKey) {
    return resolveApiMessage(body.messageKey, getApiAcceptLanguage());
  }
  return resolveApiMessage(ApiMessageKey.REQUEST_FAILED, getApiAcceptLanguage());
}

function isAuthLoginRequest(url?: string): boolean {
  if (!url) return false;
  return /\/auth\/(login|register|sms\/login)(?:\?|$)/.test(url);
}

function shouldHandleUnauthorized(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) return false;
  if (isAuthLoginRequest(error.config?.url)) return false;
  return Boolean(error.config?.headers?.Authorization);
}

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('douxing_token');
  config.headers['Accept-Language'] = getApiAcceptLanguage();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse;
    if (body.code !== 0) {
      return Promise.reject(new Error(resolveApiErrorMessage(body)));
    }
    return response;
  },
  (error) => {
    if (shouldHandleUnauthorized(error)) {
      unauthorizedHandler?.();
    }

    const locale = getApiAcceptLanguage();
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const body = error.response?.data as ApiResponse | undefined;
      if (body && typeof body === 'object' && 'code' in body && body.code !== 0) {
        return Promise.reject(new ApiRequestError(resolveApiErrorMessage(body), status));
      }
      const raw = error.message || error.code || '';
      return Promise.reject(
        new ApiRequestError(resolveClientRequestErrorMessage(raw, locale), status),
      );
    }
    const raw = error instanceof Error ? error.message : String(error);
    return Promise.reject(new ApiRequestError(resolveClientRequestErrorMessage(raw, locale)));
  },
);

export default http;
