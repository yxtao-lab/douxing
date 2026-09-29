import { Router } from 'express';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail, failFromError } from '../utils/response.js';
import { getUserWithRoles, updateUserProfile, setUserAvatar, completeUserOnboarding } from '../services/user.service.js';
import { getMembershipInfoForUser } from '../services/membership.service.js';
import { getUserPhotoStorageInfo } from '../services/photo-quota.service.js';
import { getUserPersona, refreshUserPersona } from '../services/travel-persona.service.js';
import { listVerificationPointEvents } from '../services/verification-points.service.js';
import {
  getPointRedemptionEntitlements,
  listPointRedemptionCatalog,
  listPointRedemptions,
  redeemPointsProduct,
} from '../services/points-redemption.service.js';
import { ApiError, ApiMessageKey, USER_INTEREST_MAX } from '@douxing/shared';

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
  /** P-TAG-01：用户偏好场景标签 slug 列表 */
  preferredScenes: z.array(z.string().min(1).max(32)).max(10).optional(),
  gender: z.string().max(32).nullable().optional(),
  ageRange: z.string().max(16).nullable().optional(),
  travelRadius: z.string().max(16).nullable().optional(),
  companionStructure: z.array(z.string().min(1).max(16)).max(4).optional(),
  budgetTier: z.string().max(32).nullable().optional(),
});

const completeOnboardingSchema = z.object({
  gender: z.string().max(32).nullable().optional(),
  ageRange: z.string().max(16).nullable().optional(),
  travelRadius: z.string().max(16).nullable().optional(),
  preferredScenes: z.array(z.string().min(1).max(32)).max(10).nullable().optional(),
  interestTags: z.array(z.string().min(1).max(16)).max(USER_INTEREST_MAX).nullable().optional(),
  companionStructure: z.array(z.string().min(1).max(16)).max(4).nullable().optional(),
  budgetTier: z.string().max(32).nullable().optional(),
  skipped: z.boolean().optional(),
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

router.get('/me/storage', authMiddleware, async (req, res) => {
  try {
    const storage = await getUserPhotoStorageInfo(req.auth!.userId);
    success(res, storage);
  } catch (err) {
    console.error('[users/me/storage]', err);
    return fail(res, ApiMessageKey.PHOTO_STORAGE_FETCH_FAILED, 500, 500);
  }
});

/**
 * U4：当前用户验证积分余额与账本（可审计）。
 */
router.get('/me/verification-points', authMiddleware, async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const summary = await listVerificationPointEvents(req.auth!.userId, page, pageSize);
    success(res, summary);
  } catch (err) {
    console.error('[users/me/verification-points]', err);
    return fail(res, ApiMessageKey.VERIFICATION_POINTS_FETCH_FAILED, 500, 500);
  }
});

const redeemSchema = z.object({
  productId: z.string().min(1).max(64),
  clientRequestId: z.string().max(128).nullable().optional(),
});

/**
 * G-INCENTIVE-01：兑换目录（含可兑状态）。
 */
router.get('/me/redemption/catalog', authMiddleware, async (req, res) => {
  try {
    const [catalog, entitlements] = await Promise.all([
      listPointRedemptionCatalog(req.auth!.userId),
      getPointRedemptionEntitlements(req.auth!.userId),
    ]);
    success(res, { catalog, entitlements });
  } catch (err) {
    if (err instanceof ApiError) return failFromError(res, err);
    console.error('[users/me/redemption/catalog]', err);
    return fail(res, ApiMessageKey.POINTS_REDEMPTION_FETCH_FAILED, 500, 500);
  }
});

/**
 * G-INCENTIVE-01：当前权益快照。
 */
router.get('/me/redemption/entitlements', authMiddleware, async (req, res) => {
  try {
    const entitlements = await getPointRedemptionEntitlements(req.auth!.userId);
    success(res, entitlements);
  } catch (err) {
    if (err instanceof ApiError) return failFromError(res, err);
    console.error('[users/me/redemption/entitlements]', err);
    return fail(res, ApiMessageKey.POINTS_REDEMPTION_FETCH_FAILED, 500, 500);
  }
});

/**
 * G-INCENTIVE-01：兑换记录。
 */
router.get('/me/redemption/history', authMiddleware, async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 20);
    const items = await listPointRedemptions(req.auth!.userId, limit);
    success(res, { items });
  } catch (err) {
    console.error('[users/me/redemption/history]', err);
    return fail(res, ApiMessageKey.POINTS_REDEMPTION_FETCH_FAILED, 500, 500);
  }
});

/**
 * G-INCENTIVE-01：兑换商品。
 */
router.post('/me/redemption/redeem', authMiddleware, async (req, res) => {
  try {
    const parsed = redeemSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, ApiMessageKey.POINTS_REDEMPTION_PRODUCT_INVALID);
    }
    const result = await redeemPointsProduct(
      req.auth!.userId,
      parsed.data.productId,
      parsed.data.clientRequestId,
    );
    success(res, result, '兑换成功');
  } catch (err) {
    if (err instanceof ApiError) return failFromError(res, err);
    console.error('[users/me/redemption/redeem]', err);
    return fail(res, ApiMessageKey.POINTS_REDEMPTION_FAILED, 500, 500);
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

/**
 * 完成首次标签引导（P-ONBOARD-01）。
 * 写入画像字段、标记 onboardedAt，并刷新旅行人格。
 */
router.post('/me/onboarding/complete', authMiddleware, async (req, res) => {
  try {
    const parsed = completeOnboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? ApiMessageKey.PARAM_ERROR);
    }
    const userInfo = await completeUserOnboarding(req.auth!.userId, parsed.data);
    if (!userInfo) {
      return fail(res, ApiMessageKey.USER_NOT_FOUND, 404, 404);
    }
    success(res, userInfo, ApiMessageKey.ONBOARDING_COMPLETED);
  } catch (err) {
    return failFromError(res, err, ApiMessageKey.ONBOARDING_FAILED);
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

router.get('/me/persona', authMiddleware, async (req, res) => {
  try {
    const persona = await getUserPersona(req.auth!.userId);
    if (!persona) {
      return fail(res, ApiMessageKey.USER_NOT_FOUND, 404, 404);
    }
    success(res, persona);
  } catch (err) {
    console.error('[users/me/persona GET]', err);
    return fail(res, ApiMessageKey.SERVER_ERROR, 500, 500);
  }
});

router.post('/me/persona/refresh', authMiddleware, async (req, res) => {
  try {
    const persona = await refreshUserPersona(req.auth!.userId);
    if (!persona) {
      return fail(res, ApiMessageKey.USER_NOT_FOUND, 404, 404);
    }
    success(res, persona, ApiMessageKey.SUCCESS);
  } catch (err) {
    console.error('[users/me/persona/refresh]', err);
    return fail(res, ApiMessageKey.SERVER_ERROR, 500, 500);
  }
});

export { uploadsDir };
export default router;
