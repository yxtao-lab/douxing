import type { Request, Response, NextFunction } from 'express';
import { API_PREFIX, ApiMessageKey, RoleCode } from '@douxing/shared';
import { fail } from '../utils/response.js';
import { getUserWithRoles } from '../services/user.service.js';
import { isSiteOnline } from '../services/site-status.service.js';

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

    if (req.auth) {
      const user = await getUserWithRoles(req.auth.userId);
      if (user?.roles.includes(RoleCode.ADMIN)) {
        next();
        return;
      }
    }

    fail(res, ApiMessageKey.SITE_OFFLINE, 503, 503);
  } catch (err) {
    console.error('[site-offline]', err);
    next();
  }
}
