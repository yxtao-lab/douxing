import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users, roles, userRoles } from '../db/schema/index.js';
import {
  findUserByUsername,
  findUserByPhone,
  getUserWithRoles,
} from '../services/user.service.js';
import { sendSmsCode, verifySmsCode } from '../services/sms.service.js';
import { ApiMessageKey, RoleCode, UserStatus, UserType } from '@douxing/shared';
import type { LoginResult, RefreshTokenResult } from '@douxing/shared';
import { success, fail, failFromError } from '../utils/response.js';
import { authMiddleware } from '../middleware/auth.js';
import { recordFailedLoginAttempt } from '../middleware/login-rate-limit.middleware.js';
import { getClientIp, parseUserAgent, recordLoginLog } from '../services/sys-log.service.js';
import { touchOnlineSession } from '../services/online-session.service.js';
import {
  getAccessTokenExpiresInSeconds,
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../services/refresh-token.service.js';

const router = Router();

const phoneSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, ApiMessageKey.INVALID_PHONE),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6).max(64),
  nickname: z.string().max(50).optional(),
});

const smsLoginSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, ApiMessageKey.INVALID_PHONE),
  code: z.string().length(6, ApiMessageKey.INVALID_SMS_CODE_LENGTH),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

/**
 * 签发 Access Token（JWT）。
 *
 * @param userId - 用户 ID
 * @param username - 用户名
 * @returns JWT 字符串
 */
function signAccessToken(userId: number, username: string): string {
  const secret = process.env.JWT_SECRET!;
  const expiresInSeconds = getAccessTokenExpiresInSeconds();
  const signOptions: SignOptions = {
    expiresIn: expiresInSeconds,
  };
  return jwt.sign({ userId, username }, secret, signOptions);
}

/**
 * 组装登录/注册成功响应（双 token + 用户信息）。
 *
 * @param userId - 用户 ID
 * @param req - 可选 Express 请求，用于在线会话与 refresh 元数据
 * @returns 登录结果；用户不存在时为 `null`
 */
async function buildLoginResult(
  userId: number,
  req?: import('express').Request,
): Promise<LoginResult | null> {
  const userInfo = await getUserWithRoles(userId);
  if (!userInfo) return null;

  const ua = req?.headers['user-agent'];
  const ip = req ? getClientIp(req) : undefined;
  const refreshToken = await issueRefreshToken(userId, {
    userAgent: typeof ua === 'string' ? ua : undefined,
    ip,
  });

  if (req) {
    touchOnlineSession({
      userId,
      username: userInfo.username,
      nickname: userInfo.nickname,
      ip: getClientIp(req),
      isLogin: true,
    });
  }

  return {
    token: signAccessToken(userId, userInfo.username),
    refreshToken,
    expiresIn: getAccessTokenExpiresInSeconds(),
    user: userInfo,
  };
}

async function assignDefaultRole(userId: number) {
  const db = getDb();
  const userRole = await db.select().from(roles).where(eq(roles.code, RoleCode.USER)).limit(1);
  if (userRole[0]) {
    await db.insert(userRoles).values({ userId, roleId: userRole[0].id });
  }
}

router.post('/sms/send', async (req, res) => {
  try {
    const parsed = phoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? ApiMessageKey.PARAM_ERROR);
    }

    const { phone } = parsed.data;
    const result = await sendSmsCode(phone);
    success(res, result, ApiMessageKey.SMS_SENT);
  } catch (err) {
    return failFromError(res, err, ApiMessageKey.SMS_SEND_FAILED);
  }
});

router.post('/sms/login', async (req, res) => {
  try {
    const parsed = smsLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? ApiMessageKey.PARAM_ERROR);
    }

    const { phone, code } = parsed.data;
    if (!verifySmsCode(phone, code)) {
      return fail(res, ApiMessageKey.SMS_CODE_INVALID);
    }

    let user = await findUserByPhone(phone);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const db = getDb();
      const username = `u_${phone}`;
      const randomPassword = randomBytes(16).toString('hex');
      const hashed = await bcrypt.hash(randomPassword, 10);

      const [result] = await db.insert(users).values({
        username,
        passwordHash: hashed,
        phone,
        nickname: `用户${phone.slice(-4)}`,
        userType: UserType.NORMAL,
        status: UserStatus.ACTIVE,
      });

      const userId = Number(result.insertId);
      await assignDefaultRole(userId);
      user = (await findUserByPhone(phone))!;
    } else if (user.status !== UserStatus.ACTIVE) {
      return fail(res, ApiMessageKey.ACCOUNT_DISABLED);
    }

    const loginResult = await buildLoginResult(user.id, req);
    if (!loginResult) {
      return fail(res, ApiMessageKey.LOGIN_FAILED, 500, 500);
    }

    const ua = parseUserAgent(req.headers['user-agent']);
    await recordLoginLog({
      username: user.username,
      ip: getClientIp(req),
      browser: ua.browser,
      os: ua.os,
      status: 1,
      msg: isNewUser ? '注册并登录' : '登录成功',
    });

    success(res, loginResult, isNewUser ? ApiMessageKey.REGISTER_SUCCESS : ApiMessageKey.LOGIN_SUCCESS);
  } catch (err) {
    console.error('[auth/sms/login]', err);
    return fail(res, '登录失败', 500, 500);
  }
});

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? ApiMessageKey.PARAM_ERROR);
    }
    const { username, password, nickname } = parsed.data;
    const existing = await findUserByUsername(username);
    if (existing) return fail(res, ApiMessageKey.USERNAME_EXISTS);

    const db = getDb();
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.insert(users).values({
      username,
      passwordHash: hashed,
      nickname: nickname ?? username,
      userType: UserType.NORMAL,
      status: UserStatus.ACTIVE,
    });

    const userId = Number(result.insertId);
    await assignDefaultRole(userId);

    const loginResult = await buildLoginResult(userId, req);
    if (!loginResult) return fail(res, ApiMessageKey.REGISTER_FAILED, 500, 500);

    const ua = parseUserAgent(req.headers['user-agent']);
    await recordLoginLog({
      username: parsed.data.username,
      ip: getClientIp(req),
      browser: ua.browser,
      os: ua.os,
      status: 1,
      msg: '注册成功',
    });

    success(res, loginResult, ApiMessageKey.REGISTER_SUCCESS);
  } catch (err) {
    console.error('[auth/register]', err);
    return fail(res, '注册失败', 500, 500);
  }
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, ApiMessageKey.PARAM_ERROR);
  }

  const { username, password } = parsed.data;
  const user = await findUserByUsername(username);
  if (!user) {
    await recordFailedLoginAttempt(req, username);
    return fail(res, ApiMessageKey.INVALID_CREDENTIALS);
  }

  if (user.status !== UserStatus.ACTIVE) {
    return fail(res, '账号已禁用');
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    await recordFailedLoginAttempt(req, username);
    const ua = parseUserAgent(req.headers['user-agent']);
    await recordLoginLog({
      username,
      ip: getClientIp(req),
      browser: ua.browser,
      os: ua.os,
      status: 0,
      msg: '密码错误',
    });
    return fail(res, ApiMessageKey.INVALID_CREDENTIALS);
  }

  const loginResult = await buildLoginResult(user.id, req);
  if (!loginResult) {
    return fail(res, ApiMessageKey.USER_DATA_ERROR, 500, 500);
  }

  const ua = parseUserAgent(req.headers['user-agent']);
  await recordLoginLog({
    username,
    ip: getClientIp(req),
    browser: ua.browser,
    os: ua.os,
    status: 1,
    msg: '登录成功',
  });

  success(res, loginResult, ApiMessageKey.LOGIN_SUCCESS);
});

router.post('/refresh', async (req, res) => {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, ApiMessageKey.PARAM_ERROR);
    }

    const rotated = await rotateRefreshToken(parsed.data.refreshToken);
    if (!rotated) {
      return fail(res, ApiMessageKey.REFRESH_TOKEN_INVALID, 401, 401);
    }

    const userInfo = await getUserWithRoles(rotated.userId);
    if (!userInfo || userInfo.status !== UserStatus.ACTIVE) {
      await revokeRefreshToken(rotated.newRawToken);
      return fail(res, ApiMessageKey.REFRESH_TOKEN_EXPIRED, 401, 401);
    }

    const payload: RefreshTokenResult = {
      token: signAccessToken(rotated.userId, userInfo.username),
      refreshToken: rotated.newRawToken,
      expiresIn: getAccessTokenExpiresInSeconds(),
    };

    success(res, payload, ApiMessageKey.OK);
  } catch (err) {
    console.error('[auth/refresh]', err);
    return fail(res, ApiMessageKey.SERVER_ERROR, 500, 500);
  }
});

router.post('/logout', async (req, res) => {
  try {
    const parsed = logoutSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, ApiMessageKey.PARAM_ERROR);
    }

    if (parsed.data.refreshToken) {
      await revokeRefreshToken(parsed.data.refreshToken);
    }

    success(res, null, ApiMessageKey.LOGOUT_SUCCESS);
  } catch (err) {
    console.error('[auth/logout]', err);
    return fail(res, ApiMessageKey.SERVER_ERROR, 500, 500);
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  const userInfo = await getUserWithRoles(req.auth!.userId);
  if (!userInfo) {
    return fail(res, ApiMessageKey.USER_NOT_FOUND, 404, 404);
  }
  success(res, userInfo);
});

export default router;
