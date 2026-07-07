import type { ApiResponse, RefreshTokenResult } from '@douxing/shared';
import {
  ApiMessageKey,
  createTokenRefreshCoordinator,
  resolveApiMessage,
} from '@douxing/shared';
import { getApiAcceptLanguage } from './api-locale-header';
import { getApiBaseUrl } from './api-base';
import {
  clearAuth,
  getStoredRefreshToken,
  updateStoredTokens,
} from './auth-storage';

let unauthorizedHandler: (() => void) | null = null;

/**
 * 注册全局未授权回调（refresh 失败时清会话并跳转登录）。
 *
 * @param handler - 无 refresh token 或 refresh 失败时执行
 */
export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

/**
 * 调用 /auth/refresh 换取新双 token。
 *
 * @returns 新 Access Token；失败时为 `null`
 */
async function performTokenRefresh(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  const url = `${getApiBaseUrl()}/auth/refresh`;
  try {
    const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
      uni.request({
        url,
        method: 'POST',
        data: { refreshToken },
        header: {
          'Content-Type': 'application/json',
          'Accept-Language': getApiAcceptLanguage(),
        },
        timeout: 15000,
        success: resolve,
        fail: reject,
      });
    });

    const status = res.statusCode ?? 0;
    const body = res.data as ApiResponse<RefreshTokenResult>;
    if (status !== 200 || body.code !== 0 || !body.data?.token || !body.data?.refreshToken) {
      return null;
    }

    updateStoredTokens(body.data.token, body.data.refreshToken);
    return body.data.token;
  } catch {
    return null;
  }
}

const refreshAccessToken = createTokenRefreshCoordinator(performTokenRefresh);

/**
 * Access Token 过期时尝试无感刷新。
 *
 * @returns 新 Access Token；不可刷新时为 `null`
 */
export async function tryRefreshAccessToken(): Promise<string | null> {
  return refreshAccessToken();
}

/**
 * 判断响应是否为 Access Token 过期（可尝试 refresh）。
 *
 * @param statusCode - HTTP 状态码
 * @param body - API 响应体
 * @returns 是否为 token 过期
 */
export function isAccessTokenExpiredResponse(
  statusCode: number,
  body: ApiResponse<unknown> | undefined,
): boolean {
  return statusCode === 401 && body?.messageKey === ApiMessageKey.TOKEN_EXPIRED;
}

/**
 * refresh 失败后触发登出流程。
 *
 * @param fallbackMessage - 提示文案 fallback
 * @returns 面向用户的错误信息
 */
export function handleUnauthorizedAfterRefreshFailed(fallbackMessage?: string): string {
  clearAuth();
  unauthorizedHandler?.();
  const locale = getApiAcceptLanguage();
  return (
    fallbackMessage ??
    resolveApiMessage(ApiMessageKey.TOKEN_EXPIRED, locale)
  );
}

/**
 * 登出并吊销 Refresh Token（失败不阻塞本地清会话）。
 *
 * @returns Promise，始终 resolve
 */
export async function logoutRemote(): Promise<void> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return;

  const url = `${getApiBaseUrl()}/auth/logout`;
  try {
    await new Promise<void>((resolve) => {
      uni.request({
        url,
        method: 'POST',
        data: { refreshToken },
        header: {
          'Content-Type': 'application/json',
          'Accept-Language': getApiAcceptLanguage(),
        },
        complete: () => resolve(),
      });
    });
  } catch {
    /* ignore */
  }
}
