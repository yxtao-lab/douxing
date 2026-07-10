import type { Request, Response, NextFunction } from 'express';
import { ApiMessageKey } from '@douxing/shared';
import { fail } from '../utils/response.js';
import { getOrgRoleForUser } from '../services/marketplace/marketplace-org-onboard.service.js';

/** 商户端请求上下文 */
export interface OrgContext {
  orgId: number;
  orgRole: string;
  userId: number;
}

declare global {
  namespace Express {
    interface Request {
      orgContext?: OrgContext;
    }
  }
}

/**
 * 从请求头或查询参数解析商户组织 ID。
 *
 * @param req - Express 请求
 * @returns 有效 org id；缺失或非法时 `null`
 */
function parseOrgIdFromRequest(req: Request): number | null {
  const headerRaw = req.headers['x-org-id'];
  const headerValue = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  const queryRaw = req.query.org_id ?? req.query.orgId;
  const queryValue = Array.isArray(queryRaw) ? queryRaw[0] : queryRaw;
  const raw = (headerValue ?? queryValue ?? '').toString().trim();
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * 可选解析商户组织上下文（不阻断请求）。
 *
 * @param req - Express 请求
 * @param _res - Express 响应
 * @param next - 继续管道
 * @returns 无返回值；解析成功时写入 `req.orgContext`
 */
export async function orgContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  const orgId = parseOrgIdFromRequest(req);
  const userId = req.auth?.userId;
  if (orgId && userId) {
    const orgRole = await getOrgRoleForUser(userId, orgId);
    if (orgRole) {
      req.orgContext = { orgId, orgRole, userId };
    }
  }
  next();
}

/**
 * 要求请求携带有效商户组织上下文且用户为成员。
 *
 * @param req - Express 请求
 * @param res - Express 响应
 * @param next - 继续管道
 * @returns 校验失败时直接响应 401/403
 */
export async function requireOrgContext(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.userId) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  const orgId = parseOrgIdFromRequest(req);
  if (!orgId) {
    fail(res, ApiMessageKey.MARKETPLACE_ORG_CONTEXT_REQUIRED, 400, 400);
    return;
  }

  const orgRole = await getOrgRoleForUser(req.auth.userId, orgId);
  if (!orgRole) {
    fail(res, ApiMessageKey.MARKETPLACE_ORG_MEMBER_FORBIDDEN, 403, 403);
    return;
  }

  req.orgContext = {
    orgId,
    orgRole,
    userId: req.auth.userId,
  };
  next();
}
