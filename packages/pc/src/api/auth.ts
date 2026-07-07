import http, { refreshAccessToken } from './http';
import type { ApiResponse, LoginResult, RefreshTokenResult } from '@douxing/shared';

export async function login(username: string, password: string) {
  const { data } = await http.post<ApiResponse<LoginResult>>('/auth/login', {
    username,
    password,
  });
  return data.data;
}

export async function register(username: string, password: string, nickname?: string) {
  const { data } = await http.post<ApiResponse<LoginResult>>('/auth/register', {
    username,
    password,
    nickname,
  });
  return data.data;
}

export async function sendSmsCode(phone: string) {
  const { data } = await http.post<ApiResponse<{ devCode?: string }>>('/auth/sms/send', {
    phone,
  });
  return data.data;
}

export async function smsLogin(phone: string, code: string) {
  const { data } = await http.post<ApiResponse<LoginResult>>('/auth/sms/login', {
    phone,
    code,
  });
  return data.data;
}

export async function fetchCurrentUser() {
  const { data } = await http.get<ApiResponse<LoginResult['user']>>('/auth/me');
  return data.data;
}

/**
 * 主动刷新 Access Token（bootstrap 或业务层调用）。
 *
 * @returns 新 Access Token；失败时为 `null`
 */
export async function tryRefreshSession(): Promise<string | null> {
  return refreshAccessToken();
}

/**
 * 登出并吊销 Refresh Token。
 *
 * @param refreshToken - 本地 Refresh Token；为空时仅清客户端
 */
export async function logoutSession(refreshToken?: string | null) {
  if (!refreshToken) return;
  try {
    await http.post<ApiResponse<null>>('/auth/logout', { refreshToken });
  } catch {
    /* 登出接口失败不阻塞本地清会话 */
  }
}

export type { RefreshTokenResult };
