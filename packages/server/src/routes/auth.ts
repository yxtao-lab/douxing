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
import { RoleCode, UserStatus, UserType } from '@douxing/shared';
import type { LoginResult } from '@douxing/shared';
import { success, fail } from '../utils/response.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const phoneSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
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
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  code: z.string().length(6, '验证码为6位数字'),
});

function signToken(userId: number, username: string): string {
  const secret = process.env.JWT_SECRET!;
  const signOptions: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  };
  return jwt.sign({ userId, username }, secret, signOptions);
}

async function buildLoginResult(userId: number): Promise<LoginResult | null> {
  const userInfo = await getUserWithRoles(userId);
  if (!userInfo) return null;
  return { token: signToken(userId, userInfo.username), user: userInfo };
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
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }

    const { phone } = parsed.data;
    const result = await sendSmsCode(phone);
    success(res, result, '验证码已发送');
  } catch (err) {
    const message = err instanceof Error ? err.message : '发送失败';
    return fail(res, message);
  }
});

router.post('/sms/login', async (req, res) => {
  try {
    const parsed = smsLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }

    const { phone, code } = parsed.data;
    if (!verifySmsCode(phone, code)) {
      return fail(res, '验证码错误或已过期');
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
      return fail(res, '账号已禁用');
    }

    const loginResult = await buildLoginResult(user.id);
    if (!loginResult) {
      return fail(res, '登录失败', 500, 500);
    }

    success(res, loginResult, isNewUser ? '注册成功' : '登录成功');
  } catch (err) {
    console.error('[auth/sms/login]', err);
    return fail(res, '登录失败', 500, 500);
  }
});

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const { username, password, nickname } = parsed.data;
    const existing = await findUserByUsername(username);
    if (existing) return fail(res, '用户名已存在');

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

    const loginResult = await buildLoginResult(userId);
    if (!loginResult) return fail(res, '注册失败', 500, 500);

    success(res, loginResult, '注册成功');
  } catch (err) {
    console.error('[auth/register]', err);
    return fail(res, '注册失败', 500, 500);
  }
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, '参数错误');
  }

  const { username, password } = parsed.data;
  const user = await findUserByUsername(username);
  if (!user) {
    return fail(res, '用户名或密码错误');
  }

  if (user.status !== UserStatus.ACTIVE) {
    return fail(res, '账号已禁用');
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return fail(res, '用户名或密码错误');
  }

  const loginResult = await buildLoginResult(user.id);
  if (!loginResult) {
    return fail(res, '用户数据异常', 500, 500);
  }

  success(res, loginResult, '登录成功');
});

router.get('/me', authMiddleware, async (req, res) => {
  const userInfo = await getUserWithRoles(req.auth!.userId);
  if (!userInfo) {
    return fail(res, '用户不存在', 404, 404);
  }
  success(res, userInfo);
});

export default router;
