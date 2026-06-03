import type { Router } from 'vue-router';
import { fetchCurrentUser } from '@/api/auth';
import { setUnauthorizedHandler } from '@/api/http';
import { useLayoutStore } from '@/stores/layout';
import { useUserStore } from '@/stores/user';

export async function bootstrapSession(): Promise<void> {
  const userStore = useUserStore();
  if (!userStore.token) return;

  try {
    const user = await fetchCurrentUser();
    userStore.setAuth(userStore.token, user);
  } catch {
    userStore.logout();
  }
}

export function setupHttpAuthHandlers(router: Router): void {
  setUnauthorizedHandler(() => {
    const userStore = useUserStore();
    const layoutStore = useLayoutStore();
    userStore.logout();
    layoutStore.clearViews();

    if (router.currentRoute.value.name === 'login') return;

    const redirect = router.currentRoute.value.fullPath;
    router.push({
      name: 'login',
      query: redirect && redirect !== '/' ? { redirect } : undefined,
    });
  });
}
