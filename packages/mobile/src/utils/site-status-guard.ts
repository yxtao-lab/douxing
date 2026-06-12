import { fetchPublicSiteStatus } from '@/utils/site-status';

const CACHE_MS = 5000;

let cachedStatus: { online: boolean; checkedAt: number } | null = null;

export function invalidateSiteStatusGuardCache(): void {
  cachedStatus = null;
}

export async function isPublicSiteOnline(): Promise<boolean> {
  if (cachedStatus && Date.now() - cachedStatus.checkedAt < CACHE_MS) {
    return cachedStatus.online;
  }

  try {
    const status = await fetchPublicSiteStatus();
    cachedStatus = { online: status.online, checkedAt: Date.now() };
    return status.online;
  } catch {
    return true;
  }
}

export async function guardSiteOnlineRoute(): Promise<void> {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  const route = current?.route ?? '';
  const onMaintenancePage = route.includes('pages/maintenance/index');

  try {
    const status = await fetchPublicSiteStatus();
    cachedStatus = { online: status.online, checkedAt: Date.now() };

    if (!status.online && !onMaintenancePage) {
      uni.reLaunch({ url: '/pages/maintenance/index' });
      return;
    }

    if (status.online && onMaintenancePage) {
      uni.reLaunch({ url: '/pages/index/index' });
    }
  } catch {
    /* 网络异常时不阻断 */
  }
}
