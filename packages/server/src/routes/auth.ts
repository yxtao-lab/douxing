import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { findUserByUsername, getUserWithRoles } from '../services/user.service.js';
import { success, fail } from '../utils/response.js';
import { authMiddleware } from '../middleware/auth.js';
import { UserStatus } from '@douxing/shared';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
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
