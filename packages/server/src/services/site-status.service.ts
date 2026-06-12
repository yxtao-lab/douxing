import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { SystemConfigKey } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { systemConfig } from '../db/schema/index.js';

const CACHE_TTL_MS = 3000;
/** Nginx 读取此标记文件，对 pc.yxtao.site 直接返回维护页（无需 reload） */
export const PC_SITE_OFFLINE_FLAG = '.pc-site-offline';

let cachedMaintenance: { value: boolean; expiresAt: number } | null = null;

export type SiteStatusSummary = {
  online: boolean;
  maintenanceMode: boolean;
};

function getStaticRoot(): string {
  return process.env.STATIC_ROOT || path.resolve(process.cwd(), 'static');
}

export function getPcSiteOfflineFlagPath(): string {
  return path.join(getStaticRoot(), PC_SITE_OFFLINE_FLAG);
}

/** 同步 PC 静态站 Nginx 维护标记（生产 pc.yxtao.site） */
export function syncPcSiteOfflineFlag(maintenanceMode: boolean): void {
  const flagPath = getPcSiteOfflineFlagPath();
  try {
    fs.mkdirSync(path.dirname(flagPath), { recursive: true });
    if (maintenanceMode) {
      fs.writeFileSync(flagPath, new Date().toISOString(), 'utf8');
    } else if (fs.existsSync(flagPath)) {
      fs.unlinkSync(flagPath);
    }
  } catch (err) {
    console.error('[site-status] sync pc offline flag failed', err);
  }
}

export async function syncPcSiteOfflineFlagFromDb(): Promise<void> {
  syncPcSiteOfflineFlag(await isMaintenanceMode());
}

function parseMaintenanceValue(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes' || value === 'on';
}

export function invalidateSiteStatusCache(): void {
  cachedMaintenance = null;
}

export async function isMaintenanceMode(): Promise<boolean> {
  if (cachedMaintenance && Date.now() < cachedMaintenance.expiresAt) {
    return cachedMaintenance.value;
  }

  try {
    const db = getDb();
    const rows = await db
      .select({ configValue: systemConfig.configValue })
      .from(systemConfig)
      .where(eq(systemConfig.configKey, SystemConfigKey.MAINTENANCE_MODE))
      .limit(1);
    const value = rows[0] ? parseMaintenanceValue(rows[0].configValue) : false;
    cachedMaintenance = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (err) {
    console.error('[site-status] read maintenance_mode failed', err);
    return false;
  }
}

export async function isSiteOnline(): Promise<boolean> {
  return !(await isMaintenanceMode());
}

export async function getSiteStatusSummary(): Promise<SiteStatusSummary> {
  const maintenanceMode = await isMaintenanceMode();
  return { online: !maintenanceMode, maintenanceMode };
}

export async function setSiteOnline(online: boolean): Promise<void> {
  const db = getDb();
  await db
    .update(systemConfig)
    .set({ configValue: online ? 'false' : 'true' })
    .where(eq(systemConfig.configKey, SystemConfigKey.MAINTENANCE_MODE));
  invalidateSiteStatusCache();
  syncPcSiteOfflineFlag(!online);
}
