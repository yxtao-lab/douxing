import type { UserInfo } from '@douxing/shared';
import {
  AUTH_TOKEN_KEY,
  AUTH_REFRESH_TOKEN_KEY,
  AUTH_USER_KEY,
} from '@douxing/shared';

export { AUTH_TOKEN_KEY as TOKEN_KEY, AUTH_USER_KEY as USER_KEY };

/** 读取本地登录用户（无 request 依赖，避免小程序生产包模块循环/压缩冲突） */
export function getStoredUser(): UserInfo | null {
  try {
    const raw = uni.getStorageSync(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

/**
 * 读取本地 Access Token。
 *
 * @returns JWT 字符串；未登录时为空字符串
 */
export function getStoredToken(): string {
  return (uni.getStorageSync(AUTH_TOKEN_KEY) as string) || '';
}

/**
 * 读取本地 Refresh Token。
 *
 * @returns refresh token 字符串；未存储时为空字符串
 */
export function getStoredRefreshToken(): string {
  return (uni.getStorageSync(AUTH_REFRESH_TOKEN_KEY) as string) || '';
}

/**
 * 写入登录凭证（双 token + 用户信息）。
 *
 * @param token - Access Token
 * @param user - 用户信息
 * @param refreshToken - Refresh Token；省略时不覆盖已有 refresh
 */
export function setAuth(token: string, user: UserInfo, refreshToken?: string) {
  uni.setStorageSync(AUTH_TOKEN_KEY, token);
  if (refreshToken) {
    uni.setStorageSync(AUTH_REFRESH_TOKEN_KEY, refreshToken);
  }
  uni.setStorageSync(AUTH_USER_KEY, JSON.stringify(user));
}

/**
 * 静默刷新后仅更新双 token。
 *
 * @param token - 新 Access Token
 * @param refreshToken - 轮换后的 Refresh Token
 */
export function updateStoredTokens(token: string, refreshToken: string) {
  uni.setStorageSync(AUTH_TOKEN_KEY, token);
  uni.setStorageSync(AUTH_REFRESH_TOKEN_KEY, refreshToken);
}

/** 清除本地登录凭证。 */
export function clearAuth() {
  uni.removeStorageSync(AUTH_TOKEN_KEY);
  uni.removeStorageSync(AUTH_REFRESH_TOKEN_KEY);
  uni.removeStorageSync(AUTH_USER_KEY);
}
