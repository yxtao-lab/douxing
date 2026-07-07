import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { UserInfo } from '@douxing/shared';
import {
  AUTH_TOKEN_KEY,
  AUTH_REFRESH_TOKEN_KEY,
  AUTH_USER_KEY,
} from '@douxing/shared';

/** 管理端会话校验状态。 */
export type SessionStatus = 'idle' | 'checking' | 'authenticated' | 'unauthenticated';

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(localStorage.getItem(AUTH_TOKEN_KEY));
  const refreshToken = ref<string | null>(localStorage.getItem(AUTH_REFRESH_TOKEN_KEY));
  const user = ref<UserInfo | null>(loadUser());
  const sessionStatus = ref<SessionStatus>('idle');

  function loadUser(): UserInfo | null {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as UserInfo;
      return { ...parsed, permissions: parsed.permissions ?? [] };
    } catch {
      return null;
    }
  }

  /**
   * 写入登录凭证与用户信息。
   *
   * @param newToken - Access Token（JWT）
   * @param newUser - 当前用户详情
   * @param newRefreshToken - Refresh Token；省略时不覆盖已有 refresh
   */
  function setAuth(newToken: string, newUser: UserInfo, newRefreshToken?: string) {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
    if (newRefreshToken) {
      refreshToken.value = newRefreshToken;
      localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, newRefreshToken);
    }
  }

  /**
   * 静默刷新后仅更新双 token（不改动用户信息）。
   *
   * @param newToken - 新 Access Token
   * @param newRefreshToken - 轮换后的 Refresh Token
   */
  function updateTokens(newToken: string, newRefreshToken: string) {
    token.value = newToken;
    refreshToken.value = newRefreshToken;
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, newRefreshToken);
  }

  /**
   * 更新会话校验状态（路由守卫与 Layout 门闩依赖此字段）。
   *
   * @param status - 新的会话状态
   */
  function setSessionStatus(status: SessionStatus) {
    sessionStatus.value = status;
  }

  /** 清除本地凭证并将会话标记为未登录。 */
  function logout() {
    token.value = null;
    refreshToken.value = null;
    user.value = null;
    sessionStatus.value = 'unauthenticated';
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }

  return {
    token,
    refreshToken,
    user,
    sessionStatus,
    setAuth,
    updateTokens,
    setSessionStatus,
    logout,
  };
});
