import { Router } from 'express';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import { getUserWithRoles } from '../services/user.service.js';
import { RoleCode, ApiMessageKey, AttractionImageSource, ApiError } from '@douxing/shared';
import {
  listAttractions,
  getAttractionById,
  listCitiesWithAttractions,
  listPendingAttractions,
  approveAttraction,
  listAttractionsForAdmin,
  updateAttractionCoverImage,
} from '../services/attraction.service.js';
import { resolvePublicBaseFromRequest, resolvePublicAssetUrl } from '../utils/public-asset-url.util.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const attractionCoversDir = path.resolve(__dirname, '../../uploads/attractions');

function ensureAttractionCoversDir() {
  if (!fs.existsSync(attractionCoversDir)) {
    fs.mkdirSync(attractionCoversDir, { recursive: true });
  }
}

const coverUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureAttractionCoversDir();
      cb(null, attractionCoversDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext.toLowerCase())
        ? ext.toLowerCase()
        : '.jpg';
      const id = parseInt(String(req.params.id), 10);
      cb(null, `${id}-${Date.now()}${safeExt}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('仅支持图片文件'));
      return;
    }
    cb(null, true);
  },
});

async function requireAdmin(req: import('express').Request, res: import('express').Response) {
  const user = await getUserWithRoles(req.auth!.userId);
  if (!user?.roles.includes(RoleCode.ADMIN)) {
    fail(res, '需要管理员权限', 403, 403);
    return null;
  }
  return user;
}

const listQuerySchema = z.object({
  city: z.string().max(64).optional(),
  cityCode: z.string().max(32).optional(),
  category: z.enum(['attraction', 'restaurant', 'hotel']).optional(),
  keyword: z.string().max(64).optional(),
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const arr = Array.isArray(v) ? v : v.split(',');
      return arr.map((t) => t.trim()).filter(Boolean);
    }),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const adminCatalogSchema = z.object({
  city: z.string().max(64).optional(),
  keyword: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

router.get('/admin/pending', authMiddleware, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const list = await listPendingAttractions(Number.isNaN(limit) ? 50 : limit);
    success(res, list);
  } catch (err) {
    console.error('[attractions/admin/pending]', err);
    return fail(res, ApiMessageKey.ATTRACTION_PENDING_FAILED, 500, 500);
  }
});

router.get('/admin/catalog', authMiddleware, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const parsed = adminCatalogSchema.safeParse(req.query);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? ApiMessageKey.PARAM_ERROR);
    }
    const list = await listAttractionsForAdmin(parsed.data);
    success(res, list);
  } catch (err) {
    console.error('[attractions/admin/catalog]', err);
    return fail(res, ApiMessageKey.ATTRACTION_LIST_FAILED, 500, 500);
  }
});

router.post('/admin/:id/cover', authMiddleware, (req, res, next) => {
  coverUpload.single('file')(req, res, (err) => {
    if (err) {
      const message = err instanceof Error ? err.message : ApiMessageKey.ATTRACTION_COVER_UPLOAD_FAILED;
      return fail(res, message);
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id) || id <= 0) {
      return fail(res, ApiMessageKey.ATTRACTION_INVALID_ID);
    }
    if (!req.file) {
      return fail(res, ApiMessageKey.ATTRACTION_COVER_UPLOAD_FAILED);
    }

    const relativePath = `/uploads/attractions/${req.file.filename}`;
    const item = await updateAttractionCoverImage(id, {
      coverImageUrl: relativePath,
      imageSource: AttractionImageSource.MANUAL,
      imageLicense: 'manual_upload',
    });
    if (!item) {
      return fail(res, ApiMessageKey.ATTRACTION_NOT_FOUND, 404, 404);
    }

    const publicBase = resolvePublicBaseFromRequest(req);
    const coverImageUrl = resolvePublicAssetUrl(relativePath, { publicBase }) ?? relativePath;
    success(res, { ...item, coverImageUrl }, ApiMessageKey.ATTRACTION_COVER_UPLOAD_SUCCESS);
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(res, err.messageKey);
    }
    console.error('[attractions/admin/cover]', err);
    return fail(res, ApiMessageKey.ATTRACTION_COVER_UPLOAD_FAILED, 500, 500);
  }
});

router.post('/admin/:id/approve', authMiddleware, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id) || id <= 0) {
      return fail(res, ApiMessageKey.ATTRACTION_INVALID_ID);
    }
    const item = await approveAttraction(id);
    if (!item) {
      return fail(res, ApiMessageKey.ATTRACTION_NOT_FOUND, 404, 404);
    }
    success(res, item, '已通过审核');
  } catch (err) {
    const message = err instanceof Error ? err.message : '审核失败';
    return fail(res, message);
  }
});

router.get('/cities', async (_req, res) => {
  try {
    const cities = await listCitiesWithAttractions();
    success(res, cities);
  } catch (err) {
    console.error('[attractions/cities]', err);
    return fail(res, ApiMessageKey.ATTRACTION_CITIES_FAILED, 500, 500);
  }
});

router.get('/', async (req, res) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? ApiMessageKey.PARAM_ERROR);
    }
    const list = await listAttractions(parsed.data);
    success(res, list);
  } catch (err) {
    console.error('[attractions/list]', err);
    return fail(res, ApiMessageKey.ATTRACTION_LIST_FAILED, 500, 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id) || id <= 0) {
      return fail(res, ApiMessageKey.ATTRACTION_INVALID_ID);
    }
    const item = await getAttractionById(id);
    if (!item) {
      return fail(res, ApiMessageKey.ATTRACTION_NOT_FOUND, 404, 404);
    }
    success(res, item);
  } catch (err) {
    console.error('[attractions/detail]', err);
    return fail(res, ApiMessageKey.ATTRACTION_DETAIL_FAILED, 500, 500);
  }
});

export default router;
