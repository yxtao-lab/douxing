import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users, roles, userRoles } from '../db/schema/index.js';
import { findUserByUsername, getUserWithRoles } from '../services/user.service.js';
import { RoleCode, UserStatus, UserType } from '@douxing/shared';
import { success, fail } from '../utils/response.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6).max(64),
  nickname: z.string().max(50).optional(),
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
    const userRole = await db.select().from(roles).where(eq(roles.code, RoleCode.USER)).limit(1);
    if (userRole[0]) {
      await db.insert(userRoles).values({ userId, roleId: userRole[0].id });
    }

    const userInfo = await getUserWithRoles(userId);
    if (!userInfo) return fail(res, '注册失败', 500, 500);

    const secret = process.env.JWT_SECRET!;
    const signOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
    };
    const token = jwt.sign({ userId, username }, secret, signOptions);
    success(res, { token, user: userInfo }, '注册成功');
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

  const userInfo = await getUserWithRoles(user.id);
  if (!userInfo) {
    return fail(res, '用户数据异常', 500, 500);
  }

  const secret = process.env.JWT_SECRET!;
  const signOptions: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  };
  const token = jwt.sign({ userId: user.id, username: user.username }, secret, signOptions);

  success(res, { token, user: userInfo }, '登录成功');
});

router.get('/me', authMiddleware, async (req, res) => {
  const userInfo = await getUserWithRoles(req.auth!.userId);
  if (!userInfo) {
    return fail(res, '用户不存在', 404, 404);
  }
  success(res, userInfo);
});

export default router;
