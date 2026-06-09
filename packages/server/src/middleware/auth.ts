import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { fail } from '../utils/response.js';
import { ApiMessageKey } from '@douxing/shared';
import { getUserWithRoles } from '../services/user.service.js';
import { touchOnlineSession } from '../services/online-session.service.js';
import { getClientIp } from '../services/sys-log.service.js';

export interface AuthPayload {
  userId: number;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return fail(res, ApiMessageKey.SERVER_CONFIG_ERROR, 500, 500);
  }

  try {
    const payload = jwt.verify(token, secret) as AuthPayload;
    req.auth = payload;
    void getUserWithRoles(payload.userId).then((user) => {
      if (user) {
        touchOnlineSession({
          userId: user.id,
          username: user.username,
          nickname: user.nickname,
          ip: getClientIp(req),
        });
      }
    });
    next();
  } catch {
    return fail(res, ApiMessageKey.TOKEN_EXPIRED, 401, 401);
  }
}
