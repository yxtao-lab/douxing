import type { Router } from 'vue-router';
import { AUTH_TOKEN_KEY } from '@douxing/shared';
import { fetchCurrentUser, tryRefreshSession } from '@/api/auth';
import { setUnauthorizedHandler, setTokensRefreshedHandler } from '@/api/http';
import { isStaffUser } from '@/composables/usePermissions';
import { useLayoutStore } from '@/stores/layout';
import { useMenuStore } from '@/stores/menu';
import { useUserStore } from '@/stores/user';
import { isPartnerPortalPath } from '@/utils/partner-session';

let bootstrapPromise: Promise<void> | null = null;
let authBootstrapping = false;

/**
 * 是否处于应用启动时的会话恢复阶段（此阶段勿触发 router 跳转，避免导航被 abort）。
 *
 * @returns 正在 bootstrap 时为 `true`
 */
export function isAuthBootstrapping(): boolean {
  return authBootstrapping;
}

/**
 * 校验员工身份并加载侧栏菜单；认证/权限失败时清会话。
 *
 * @returns 会话是否可用于管理端（员工身份且菜单未因 401/403 失败）
 */
async function finalizeStaffSession(): Promise<boolean> {
  const userStore = useUserStore();
  const menuStore = useMenuStore();

  if (!isStaffUser(userStore.user)) {
    userStore.logout();
    menuStore.clearNavTree();
    return false;
  }

  const menuResult = await menuStore.loadNavTree();
  if (menuResult === 'auth' || menuResult === 'forbidden') {
    userStore.logout();
    menuStore.clearNavTree();
    return false;
  }

  return true;
}

/**
 * 应用启动时恢复会话：校验 token、确认员工身份并预加载侧栏菜单。
 *
 * @returns 无返回值；失败时会清本地凭证并将 `sessionStatus` 置为 `unauthenticated`
 */
async function bootstrapSession(): Promise<void> {
  const userStore = useUserStore();
  const menuStore = useMenuStore();

  userStore.setSessionStatus('checking');

  if (!userStore.token) {
    userStore.setSessionStatus('unauthenticated');
    return;
  }

  try {
    let user;
    try {
      user = await fetchCurrentUser();
    } catch {
      const newToken = await tryRefreshSession();
      if (!newToken) throw new Error('session expired');
      user = await fetchCurrentUser();
    }

    const accessToken = localStorage.getItem(AUTH_TOKEN_KEY) ?? userStore.token!;
    userStore.setAuth(accessToken, user);

    const ok = await finalizeStaffSession();
    userStore.setSessionStatus(ok ? 'authenticated' : 'unauthenticated');
  } catch {
    userStore.logout();
    menuStore.clearNavTree();
    userStore.setSessionStatus('unauthenticated');
  }
}

/**
 * 单例执行 bootstrap；路由守卫与 main 均可 await，避免重复请求 /me。
 *
 * @returns bootstrap 完成后的 Promise
 */
export function ensureSessionBootstrapped(): Promise<void> {
  if (!bootstrapPromise) {
    authBootstrapping = true;
    bootstrapPromise = bootstrapSession().finally(() => {
      authBootstrapping = false;
    });
  }
  return bootstrapPromise;
}

/**
 * 登录成功后建立管理端会话（员工校验 + 菜单预加载）。
 *
 * @returns 是否成功进入可访问状态；`false` 表示非员工或菜单鉴权失败（已 logout）
 */
export async function establishSessionAfterLogin(): Promise<boolean> {
  const userStore = useUserStore();

  userStore.setSessionStatus('checking');

  if (!userStore.token || !userStore.user) {
    userStore.setSessionStatus('unauthenticated');
    return false;
  }

  const ok = await finalizeStaffSession();
  userStore.setSessionStatus(ok ? 'authenticated' : 'unauthenticated');
  return ok;
}

/**
 * 注册 HTTP 401 全局处理：清会话、清标签页并跳转登录页。
 *
 * @param router - Vue Router 实例
 */
export function setupHttpAuthHandlers(router: Router): void {
  const userStore = useUserStore();

  setTokensRefreshedHandler((accessToken, refreshToken) => {
    userStore.updateTokens(accessToken, refreshToken);
  });

  setUnauthorizedHandler(() => {
    if (isAuthBootstrapping()) {
      return;
    }

    const userStore = useUserStore();
    const layoutStore = useLayoutStore();
    const menuStore = useMenuStore();
    userStore.logout();
    menuStore.clearNavTree();
    layoutStore.clearViews();

    if (router.currentRoute.value.name === 'login') return;

    const redirect = router.currentRoute.value.fullPath;
    const isPartner = isPartnerPortalPath(redirect);
    router.push({
      name: 'login',
      query:
        redirect && redirect !== '/'
          ? isPartner
            ? { redirect, portal: 'partner' }
            : { redirect }
          : isPartner
            ? { portal: 'partner' }
            : undefined,
    });
  });
}
