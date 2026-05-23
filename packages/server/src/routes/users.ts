import { Router } from 'express';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import { getUserWithRoles, updateUserProfile, setUserAvatar } from '../services/user.service.js';
import { getMembershipInfoForUser } from '../services/membership.service.js';
import { USER_INTEREST_MAX } from '@douxing/shared';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../uploads/avatars');

function ensureUploadsDir() {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadsDir();
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext.toLowerCase())
        ? ext.toLowerCase()
        : '.jpg';
      cb(null, `${req.auth!.userId}-${Date.now()}${safeExt}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('仅支持图片文件'));
      return;
    }
    cb(null, true);
  },
});

const updateProfileSchema = z.object({
  nickname: z.string().min(1).max(64).optional(),
  avatar: z.string().max(512).nullable().optional(),
  email: z.string().email().max(128).nullable().optional(),
  interestTags: z.array(z.string().min(1).max(16)).max(USER_INTEREST_MAX).optional(),
});

function resolvePublicBase(req: { protocol: string; get: (name: string) => string | undefined }) {
  const fromEnv = process.env.API_PUBLIC_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = req.get('host');
  return `${req.protocol}://${host}`;
}

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userInfo = await getUserWithRoles(req.auth!.userId);
    if (!userInfo) {
      return fail(res, '用户不存在', 404, 404);
    }
    success(res, userInfo);
  } catch (err) {
    console.error('[users/me GET]', err);
    return fail(res, '获取资料失败', 500, 500);
  }
});

router.get('/me/membership', authMiddleware, async (req, res) => {
  try {
    const membership = await getMembershipInfoForUser(req.auth!.userId);
    if (!membership) {
      return fail(res, '用户不存在', 404, 404);
    }
    success(res, membership);
  } catch (err) {
    console.error('[users/me/membership]', err);
    return fail(res, '获取会员信息失败', 500, 500);
  }
});

router.put('/me', authMiddleware, async (req, res) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }

    const userInfo = await updateUserProfile(req.auth!.userId, parsed.data);
    if (!userInfo) {
      return fail(res, '用户不存在', 404, 404);
    }
    success(res, userInfo, '资料已更新');
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新失败';
    return fail(res, message);
  }
});

router.post('/me/avatar', authMiddleware, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const message = err instanceof Error ? err.message : '上传失败';
      return fail(res, message);
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return fail(res, '请选择图片');
    }

    const publicBase = resolvePublicBase(req);
    const avatarUrl = `${publicBase}/uploads/avatars/${req.file.filename}`;
    const userInfo = await setUserAvatar(req.auth!.userId, avatarUrl);
    if (!userInfo) {
      return fail(res, '用户不存在', 404, 404);
    }
    success(res, userInfo, '头像已更新');
  } catch (err) {
    console.error('[users/me/avatar]', err);
    return fail(res, '头像上传失败', 500, 500);
  }
});

export { uploadsDir };
export default router;
