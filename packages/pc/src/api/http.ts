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

    if (axios.isCancel(error)) {
      return Promise.reject(error);
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
