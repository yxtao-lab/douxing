import { fetchPublicSiteStatus } from '@/api/site-status';

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
