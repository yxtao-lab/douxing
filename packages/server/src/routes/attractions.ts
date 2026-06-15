import { Router } from 'express';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import '../config/env.js';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import { getUserWithRoles } from '../services/user.service.js';
import { RoleCode, ApiMessageKey, AttractionImageSource, ApiError } from '@douxing/shared';
import {
  listAttractions,
  getAttractionById,
  listCitiesWithAttractions,
  listPendingAttractionsPaginated,
  approveAttraction,
  listAttractionsForAdminPaginated,
  updateAttractionCoverImage,
} from '../services/attraction.service.js';
import { refreshAttractionCoverFromAmap } from '../services/attraction-image-enricher.service.js';
import { persistAttractionCoverBuffer } from '../services/attraction-cover-storage.service.js';
import { isOssEnabled } from '../config/oss.js';
import { parsePaginationQuery } from '../utils/pagination.js';
import {
  parseDateRangeFilter,
  parseOptionalString,
} from '../utils/admin-list-filter.js';
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
  storage: isOssEnabled()
    ? multer.memoryStorage()
    : multer.diskStorage({
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
      cb(new Error(ApiMessageKey.IMAGE_ONLY));
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
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const adminPendingSchema = z.object({
  keyword: z.string().max(64).optional(),
  city: z.string().max(64).optional(),
  category: z.enum(['attraction', 'restaurant', 'hotel']).optional(),
  source: z.enum(['seed', 'llm', 'manual', 'amap']).optional(),
  missingCoord: z
    .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => {
      if (v === '1' || v === 'true') return true;
      if (v === '0' || v === 'false') return false;
      return undefined;
    }),
  dateStart: z.string().max(10).optional(),
  dateEnd: z.string().max(10).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

router.get('/admin/pending', authMiddleware, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const parsed = adminPendingSchema.safeParse(req.query);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? ApiMessageKey.PARAM_ERROR);
    }
    const { page, pageSize } = parsePaginationQuery({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
    const result = await listPendingAttractionsPaginated(page, pageSize, {
      keyword: parsed.data.keyword,
      city: parsed.data.city,
      category: parsed.data.category,
      source: parsed.data.source,
      missingCoord: parsed.data.missingCoord,
      dateStart: parsed.data.dateStart,
      dateEnd: parsed.data.dateEnd,
    });
    success(res, result);
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
    const { page, pageSize } = parsePaginationQuery({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
    const result = await listAttractionsForAdminPaginated({
      city: parsed.data.city,
      keyword: parsed.data.keyword,
      page,
      pageSize,
    });
    success(res, result);
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

    let relativePath: string;
    if (isOssEnabled() && req.file.buffer) {
      const { storedUrl } = await persistAttractionCoverBuffer(
        id,
        req.file.buffer,
        req.file.mimetype,
        'manual',
      );
      relativePath = storedUrl;
    } else {
      relativePath = `/uploads/attractions/${req.file.filename}`;
    }

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

router.post('/admin/:id/cover/refresh-amap', authMiddleware, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id) || id <= 0) {
      return fail(res, ApiMessageKey.ATTRACTION_INVALID_ID);
    }

    const existing = await getAttractionById(id);
    if (!existing) {
      return fail(res, ApiMessageKey.ATTRACTION_NOT_FOUND, 404, 404);
    }
    if (existing.imageSource === AttractionImageSource.MANUAL) {
      return fail(res, ApiMessageKey.ATTRACTION_COVER_REFRESH_MANUAL_SKIP);
    }

    const item = await refreshAttractionCoverFromAmap(id);
    if (!item?.coverImageUrl) {
      return fail(res, ApiMessageKey.ATTRACTION_COVER_REFRESH_FAILED);
    }

    const publicBase = resolvePublicBaseFromRequest(req);
    const coverImageUrl = resolvePublicAssetUrl(item.coverImageUrl, { publicBase }) ?? item.coverImageUrl;
    success(res, { ...item, coverImageUrl }, ApiMessageKey.ATTRACTION_COVER_REFRESH_SUCCESS);
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(res, err.messageKey);
    }
    console.error('[attractions/admin/cover/refresh-amap]', err);
    return fail(res, ApiMessageKey.ATTRACTION_COVER_REFRESH_FAILED, 500, 500);
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
