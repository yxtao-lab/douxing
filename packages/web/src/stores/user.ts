import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { UserInfo } from '@douxing/shared';

const TOKEN_KEY = 'douxing_token';
const USER_KEY = 'douxing_user';

/** 管理端会话校验状态。 */
export type SessionStatus = 'idle' | 'checking' | 'authenticated' | 'unauthenticated';

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const user = ref<UserInfo | null>(loadUser());
  const sessionStatus = ref<SessionStatus>('idle');

  function loadUser(): UserInfo | null {
    const raw = localStorage.getItem(USER_KEY);
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
   * @param newToken - JWT
   * @param newUser - 当前用户详情
   */
  function setAuth(newToken: string, newUser: UserInfo) {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
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
    user.value = null;
    sessionStatus.value = 'unauthenticated';
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  return { token, user, sessionStatus, setAuth, setSessionStatus, logout };
});
