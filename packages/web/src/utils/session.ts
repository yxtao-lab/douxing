import type { Router } from 'vue-router';
import { fetchCurrentUser } from '@/api/auth';
import { setUnauthorizedHandler } from '@/api/http';
import { isStaffUser } from '@/composables/usePermissions';
import { useLayoutStore } from '@/stores/layout';
import { useMenuStore } from '@/stores/menu';
import { useUserStore } from '@/stores/user';

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
export async function bootstrapSession(): Promise<void> {
  const userStore = useUserStore();
  const menuStore = useMenuStore();

  userStore.setSessionStatus('checking');

  if (!userStore.token) {
    userStore.setSessionStatus('unauthenticated');
    return;
  }

  try {
    const user = await fetchCurrentUser();
    userStore.setAuth(userStore.token, user);

    const ok = await finalizeStaffSession();
    userStore.setSessionStatus(ok ? 'authenticated' : 'unauthenticated');
  } catch {
    userStore.logout();
    menuStore.clearNavTree();
    userStore.setSessionStatus('unauthenticated');
  }
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
  setUnauthorizedHandler(() => {
    const userStore = useUserStore();
    const layoutStore = useLayoutStore();
    const menuStore = useMenuStore();
    userStore.logout();
    menuStore.clearNavTree();
    layoutStore.clearViews();

    if (router.currentRoute.value.name === 'login') return;

    const redirect = router.currentRoute.value.fullPath;
    router.push({
      name: 'login',
      query: redirect && redirect !== '/' ? { redirect } : undefined,
    });
  });
}
