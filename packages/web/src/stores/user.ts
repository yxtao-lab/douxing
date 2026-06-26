import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { UserInfo } from '@douxing/shared';

const TOKEN_KEY = 'douxing_token';
const USER_KEY = 'douxing_user';

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const user = ref<UserInfo | null>(loadUser());

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

  function setAuth(newToken: string, newUser: UserInfo) {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  return { token, user, setAuth, logout };
});
