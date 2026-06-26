import type { Request, Response } from 'express';
import { ApiMessageKey, RoleCode } from '@douxing/shared';
import type { UserInfo } from '@douxing/shared';
import { fail } from '../utils/response.js';
import { getUserWithRoles } from '../services/user.service.js';
import { hasPermission, isAdminRole } from '../services/permission.service.js';

export async function requireAdmin(
  req: Request,
  res: Response,
): Promise<UserInfo | null> {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return null;
  }
  const user = await getUserWithRoles(req.auth.userId);
  if (!user) {
    fail(res, ApiMessageKey.USER_NOT_FOUND, 404, 404);
    return null;
  }
  if (!isAdminRole(user.roles)) {
    fail(res, ApiMessageKey.ADMIN_REQUIRED, 403, 403);
    return null;
  }
  return user;
}

/** 满足 required 中任一 perm 即可；admin 角色 bypass */
export async function requirePerm(
  req: Request,
  res: Response,
  ...required: string[]
): Promise<UserInfo | null> {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return null;
  }
  const user = await getUserWithRoles(req.auth.userId);
  if (!user) {
    fail(res, ApiMessageKey.USER_NOT_FOUND, 404, 404);
    return null;
  }
  if (required.length === 0) {
    fail(res, ApiMessageKey.FORBIDDEN, 403, 403);
    return null;
  }
  if (!hasPermission(user.roles, user.permissions, required)) {
    fail(res, ApiMessageKey.FORBIDDEN, 403, 403);
    return null;
  }
  return user;
}

/** 管理端任意菜单权限或 admin 角色 */
export async function requireStaff(
  req: Request,
  res: Response,
): Promise<UserInfo | null> {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return null;
  }
  const user = await getUserWithRoles(req.auth.userId);
  if (!user) {
    fail(res, ApiMessageKey.USER_NOT_FOUND, 404, 404);
    return null;
  }
  if (!isAdminRole(user.roles) && user.permissions.length === 0) {
    fail(res, ApiMessageKey.ADMIN_REQUIRED, 403, 403);
    return null;
  }
  return user;
}
