import type { Request, Response, NextFunction } from 'express';
import { API_PREFIX, ApiMessageKey, RoleCode } from '@douxing/shared';
import { fail } from '../utils/response.js';
import { getUserWithRoles } from '../services/user.service.js';
import { isSiteOnline } from '../services/site-status.service.js';

const ADMIN_BYPASS_CACHE_MS = 30_000;
const adminBypassCache = new Map<number, { isAdmin: boolean; expiresAt: number }>();

function isPublicStatusPath(path: string, method: string): boolean {
  if (method !== 'GET') return false;
  return path === `${API_PREFIX}/health` || path === `${API_PREFIX}/status` || path === '/health' || path === '/status';
}

function isAdminLoginPath(path: string, method: string): boolean {
  if (method !== 'POST') return false;
  return path === `${API_PREFIX}/auth/login`;
}

function isSystemAdminPath(path: string): boolean {
  return path.startsWith(`${API_PREFIX}/system`);
}

async function isAdminUser(userId: number): Promise<boolean> {
  const cached = adminBypassCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.isAdmin;
  }

  const user = await getUserWithRoles(userId);
  const isAdmin = user?.roles.includes(RoleCode.ADMIN) ?? false;
  adminBypassCache.set(userId, { isAdmin, expiresAt: Date.now() + ADMIN_BYPASS_CACHE_MS });
  return isAdmin;
}

export async function siteOfflineMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const path = req.path;

    if (isPublicStatusPath(path, req.method)) {
      next();
      return;
    }

    if (isSystemAdminPath(path)) {
      next();
      return;
    }

    if (isAdminLoginPath(path, req.method)) {
      next();
      return;
    }

    if (await isSiteOnline()) {
      next();
      return;
    }

    if (req.auth && (await isAdminUser(req.auth.userId))) {
      next();
      return;
    }

    fail(res, ApiMessageKey.SITE_OFFLINE, 503, 503);
  } catch (err) {
    console.error('[site-offline]', err);
    next();
  }
}
