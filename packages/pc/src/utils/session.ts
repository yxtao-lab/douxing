import type { Router } from 'vue-router';
import { fetchCurrentUser, tryRefreshSession } from '@/api/auth';
import { setUnauthorizedHandler, setTokensRefreshedHandler } from '@/api/http';
import { useUserStore } from '@/stores/user';

/**
 * 应用启动时恢复会话；Access Token 过期时尝试 refresh。
 *
 * @returns 无返回值；失败时会清本地凭证
 */
export async function bootstrapSession(): Promise<void> {
  const userStore = useUserStore();
  if (!userStore.token) return;

  try {
    let user;
    try {
      user = await fetchCurrentUser();
    } catch {
      const newToken = await tryRefreshSession();
      if (!newToken) throw new Error('session expired');
      user = await fetchCurrentUser();
    }
    userStore.setAuth(userStore.token!, user);
  } catch {
    userStore.logout();
  }
}

/**
 * 注册 HTTP 401 全局处理：清会话并跳转登录页。
 *
 * @param router - Vue Router 实例
 */
export function setupHttpAuthHandlers(router: Router): void {
  const userStore = useUserStore();

  setTokensRefreshedHandler((accessToken, refreshToken) => {
    userStore.updateTokens(accessToken, refreshToken);
  });

  setUnauthorizedHandler(() => {
    userStore.logout();

    if (router.currentRoute.value.name === 'login') return;

    const redirect = router.currentRoute.value.fullPath;
    router.push({
      name: 'login',
      query: redirect && redirect !== '/' ? { redirect } : undefined,
    });
  });
}
