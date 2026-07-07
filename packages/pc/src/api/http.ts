import axios from 'axios';
import type { ApiResponse } from '@douxing/shared';
import {
  ApiMessageKey,
  LOCALE_STORAGE_KEY,
  DEFAULT_LOCALE,
  isLocaleCode,
  resolveApiMessage,
  resolveClientRequestErrorMessage,
  createTokenRefreshCoordinator,
  AUTH_TOKEN_KEY,
  AUTH_REFRESH_TOKEN_KEY,
  type LocaleCode,
} from '@douxing/shared';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
});

let unauthorizedHandler: (() => void) | null = null;
let onTokensRefreshed: ((accessToken: string, refreshToken: string) => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

/**
 * 注册 token 静默刷新成功回调（同步 Pinia 等状态）。
 *
 * @param handler - 收到新双 token 时执行
 */
export function setTokensRefreshedHandler(
  handler: (accessToken: string, refreshToken: string) => void,
) {
  onTokensRefreshed = handler;
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

function isAuthRefreshRequest(url?: string): boolean {
  if (!url) return false;
  return /\/auth\/refresh(?:\?|$)/.test(url);
}

function shouldHandleUnauthorized(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) return false;
  if (isAuthLoginRequest(error.config?.url)) return false;
  if (isAuthRefreshRequest(error.config?.url)) return false;
  return Boolean(error.config?.headers?.Authorization);
}

function isTokenExpiredResponse(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const body = error.response?.data as ApiResponse | undefined;
  return body?.messageKey === ApiMessageKey.TOKEN_EXPIRED;
}

/**
 * 调用 /auth/refresh 换取新双 token（不经拦截器，避免循环）。
 *
 * @returns 新 Access Token；失败时为 `null`
 */
async function performTokenRefresh(): Promise<string | null> {
  const storedRefresh = localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
  if (!storedRefresh) return null;

  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
  try {
    const { data } = await axios.post<ApiResponse<{ token: string; refreshToken: string }>>(
      `${baseURL}/auth/refresh`,
      { refreshToken: storedRefresh },
      {
        headers: { 'Accept-Language': getApiAcceptLanguage() },
        timeout: 15000,
      },
    );
    if (data.code !== 0 || !data.data?.token || !data.data?.refreshToken) {
      return null;
    }
    localStorage.setItem(AUTH_TOKEN_KEY, data.data.token);
    localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, data.data.refreshToken);
    onTokensRefreshed?.(data.data.token, data.data.refreshToken);
    return data.data.token;
  } catch {
    return null;
  }
}

const refreshAccessToken = createTokenRefreshCoordinator(performTokenRefresh);

/** 供 bootstrapSession 等场景主动尝试 refresh。 */
export { refreshAccessToken };

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
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
  async (error) => {
    const originalRequest = error.config;

    if (
      axios.isAxiosError(error) &&
      originalRequest &&
      !(originalRequest as { _retry?: boolean })._retry &&
      shouldHandleUnauthorized(error) &&
      isTokenExpiredResponse(error)
    ) {
      (originalRequest as { _retry?: boolean })._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return http(originalRequest);
      }
      unauthorizedHandler?.();
    } else if (shouldHandleUnauthorized(error)) {
      unauthorizedHandler?.();
    }

    const locale = getApiAcceptLanguage();
    if (axios.isAxiosError(error)) {
      const body = error.response?.data as ApiResponse | undefined;
      if (body && typeof body === 'object' && 'code' in body && body.code !== 0) {
        return Promise.reject(new Error(resolveApiErrorMessage(body)));
      }
      const raw = error.message || error.code || '';
      return Promise.reject(new Error(resolveClientRequestErrorMessage(raw, locale)));
    }
    const raw = error instanceof Error ? error.message : String(error);
    return Promise.reject(new Error(resolveClientRequestErrorMessage(raw, locale)));
  },
);

export default http;
