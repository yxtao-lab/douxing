import { Router } from 'express';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import {
  createCheckIn,
  listUserCheckInsPaginated,
  listRouteCheckInsPaginated,
  listAllCheckInsForAdminPaginated,
} from '../services/checkin.service.js';
import { parsePaginationQuery } from '../utils/pagination.js';
import {
  parseDateRangeFilter,
  parseOptionalInt,
  parseOptionalString,
} from '../utils/admin-list-filter.js';
import type { CheckInTimeRange } from '@douxing/shared';
import { getUserWithRoles } from '../services/user.service.js';
import { RoleCode, CHECKIN_MAX_PHOTOS } from '@douxing/shared';
import { isCheckinValidationError } from '../utils/checkin-errors.js';
import { resolvePublicBaseFromRequest, resolvePublicAssetUrl } from '../utils/public-asset-url.util.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const checkInPhotosDir = path.resolve(__dirname, '../../uploads/checkins');

function ensureCheckInPhotosDir() {
  if (!fs.existsSync(checkInPhotosDir)) {
    fs.mkdirSync(checkInPhotosDir, { recursive: true });
  }
}

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureCheckInPhotosDir();
      cb(null, checkInPhotosDir);
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

const checkInSchema = z.object({
  routeId: z.number().int().positive(),
  attractionId: z.number().int().positive().optional(),
  cityCode: z.string().min(1).max(32).optional(),
  cityName: z.string().min(1).max(64).optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().optional(),
    placeName: z.string().min(1, '请填写打卡地点'),
  }),
  targetLatitude: z.number().min(-90).max(90).optional(),
  targetLongitude: z.number().min(-180).max(180).optional(),
  gpsAccuracy: z.number().positive().max(500).optional(),
  photos: z.array(z.string().url().max(512)).max(CHECKIN_MAX_PHOTOS).optional(),
  remark: z.string().max(512).optional(),
  addToAlbum: z.boolean().optional(),
});

router.post('/photos', authMiddleware, (req, res, next) => {
  photoUpload.single('file')(req, res, (err) => {
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

    const relativePath = `/uploads/checkins/${req.file.filename}`;
    const publicBase = resolvePublicBaseFromRequest(req);
    const photoUrl = resolvePublicAssetUrl(relativePath, { publicBase }) ?? relativePath;
    success(res, { url: photoUrl, path: relativePath }, '上传成功');
  } catch (err) {
    console.error('[checkins/photos]', err);
    return fail(res, '照片上传失败', 500, 500);
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const parsed = checkInSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const { checkIn, newAchievements, newBadges } = await createCheckIn(req.auth!.userId, parsed.data);
    success(res, { checkIn, newAchievements, newBadges }, '打卡成功');
  } catch (err) {
    const message = err instanceof Error ? err.message : '打卡失败';
    console.error('[checkins/create]', err);
    const isClientError = isCheckinValidationError(err);
    return fail(res, message, 1, isClientError ? 400 : 500);
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page, pageSize } = parsePaginationQuery(req.query as Record<string, unknown>);
    const rangeRaw = typeof req.query.range === 'string' ? req.query.range : undefined;
    const range =
      rangeRaw === '7d' || rangeRaw === '30d' || rangeRaw === '90d' || rangeRaw === 'all'
        ? (rangeRaw as CheckInTimeRange)
        : undefined;

    const user = await getUserWithRoles(req.auth!.userId);
    if (user?.roles.includes(RoleCode.ADMIN) && req.query.all === '1') {
      const query = req.query as Record<string, unknown>;
      const { dateStart, dateEnd } = parseDateRangeFilter(query);
      const result = await listAllCheckInsForAdminPaginated(page, pageSize, {
        keyword: parseOptionalString(query, 'keyword'),
        userId: parseOptionalInt(query, 'userId'),
        routeId: parseOptionalInt(query, 'routeId'),
        cityCode: parseOptionalString(query, 'cityCode'),
        dateStart,
        dateEnd,
      });
      return success(res, result);
    }
    const routeId = req.query.routeId ? parseInt(String(req.query.routeId), 10) : null;
    if (routeId && !Number.isNaN(routeId)) {
      const result = await listRouteCheckInsPaginated(routeId, req.auth!.userId, page, pageSize);
      return success(res, result);
    }
    const result = await listUserCheckInsPaginated(req.auth!.userId, page, pageSize, range);
    success(res, result);
  } catch (err) {
    console.error('[checkins/list]', err);
    return fail(res, '获取打卡记录失败', 500, 500);
  }
});

export { checkInPhotosDir };
export default router;
