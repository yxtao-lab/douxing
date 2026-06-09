import type { Request, Response } from 'express';
import { ApiMessageKey, RoleCode } from '@douxing/shared';
import { fail } from '../utils/response.js';
import { getUserWithRoles } from '../services/user.service.js';
import type { UserInfo } from '@douxing/shared';

export async function requireAdmin(
  req: Request,
  res: Response,
): Promise<UserInfo | null> {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return null;
  }
  const user = await getUserWithRoles(req.auth.userId);
  if (!user?.roles.includes(RoleCode.ADMIN)) {
    fail(res, ApiMessageKey.ADMIN_REQUIRED, 403, 403);
    return null;
  }
  return user;
}
