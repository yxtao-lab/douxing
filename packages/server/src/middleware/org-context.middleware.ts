import type { Request, Response, NextFunction } from 'express';

/** 商户端请求上下文（M1 完善鉴权与数据隔离） */
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
 * 解析商户组织上下文中间件骨架（M0 占位，M1 实现 `x-org-id` 与成员校验）。
 *
 * @param _req - Express 请求
 * @param _res - Express 响应
 * @param next - 继续管道
 * @returns 无返回值；M1 前始终 `next()`
 */
export function orgContextMiddleware(_req: Request, _res: Response, next: NextFunction) {
  next();
}
