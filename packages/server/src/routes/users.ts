import { Router } from 'express';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail, failFromError } from '../utils/response.js';
import { getUserWithRoles, updateUserProfile, setUserAvatar } from '../services/user.service.js';
import { getMembershipInfoForUser } from '../services/membership.service.js';
import { ApiMessageKey, USER_INTEREST_MAX } from '@douxing/shared';

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
      cb(new Error(ApiMessageKey.IMAGE_ONLY));
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

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userInfo = await getUserWithRoles(req.auth!.userId);
    if (!userInfo) {
      return fail(res, ApiMessageKey.USER_NOT_FOUND, 404, 404);
    }
    success(res, userInfo);
  } catch (err) {
    console.error('[users/me GET]', err);
    return fail(res, ApiMessageKey.PROFILE_FETCH_FAILED, 500, 500);
  }
});

router.get('/me/membership', authMiddleware, async (req, res) => {
  try {
    const membership = await getMembershipInfoForUser(req.auth!.userId);
    if (!membership) {
      return fail(res, ApiMessageKey.USER_NOT_FOUND, 404, 404);
    }
    success(res, membership);
  } catch (err) {
    console.error('[users/me/membership]', err);
    return fail(res, ApiMessageKey.MEMBERSHIP_FETCH_FAILED, 500, 500);
  }
});

router.put('/me', authMiddleware, async (req, res) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? ApiMessageKey.PARAM_ERROR);
    }

    const userInfo = await updateUserProfile(req.auth!.userId, parsed.data);
    if (!userInfo) {
      return fail(res, ApiMessageKey.USER_NOT_FOUND, 404, 404);
    }
    success(res, userInfo, ApiMessageKey.PROFILE_UPDATED);
  } catch (err) {
    return failFromError(res, err, ApiMessageKey.PROFILE_UPDATE_FAILED);
  }
});

router.post('/me/avatar', authMiddleware, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return failFromError(res, err, ApiMessageKey.UPLOAD_FAILED);
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return fail(res, ApiMessageKey.IMAGE_REQUIRED);
    }

    const relativePath = `/uploads/avatars/${req.file.filename}`;
    const userInfo = await setUserAvatar(req.auth!.userId, relativePath);
    if (!userInfo) {
      return fail(res, ApiMessageKey.USER_NOT_FOUND, 404, 404);
    }
    success(res, userInfo, ApiMessageKey.AVATAR_UPDATED);
  } catch (err) {
    console.error('[users/me/avatar]', err);
    return fail(res, ApiMessageKey.AVATAR_UPLOAD_FAILED, 500, 500);
  }
});

export { uploadsDir };
export default router;
