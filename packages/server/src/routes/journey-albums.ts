import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  ApiMessageKey,
  TRAVEL_PHOTO_MAX_FILE_BYTES,
} from '@douxing/shared';
import { authMiddleware } from '../middleware/auth.js';
import {
  applyExifSuggestionsForAlbum,
  createJourneyAlbum,
  deleteTravelPhoto,
  getJourneyAlbumDetail,
  getJourneyAlbumByRoute,
  listJourneyAlbumsForUser,
  listUserTravelPhotosPaginated,
  resolveAlbumDetailUrls,
  resolveAlbumPhotoUrls,
  resolveAlbumSummaryUrls,
  updateJourneyAlbumShare,
  updateTravelPhoto,
  uploadTravelPhoto,
} from '../services/journey-album.service.js';
import { fail, failFromError, success } from '../utils/response.js';
import { parsePaginationQuery } from '../utils/pagination.js';
import { resolvePublicAssetUrl, resolvePublicBaseFromRequest } from '../utils/public-asset-url.util.js';

const router = Router();

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TRAVEL_PHOTO_MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error(ApiMessageKey.IMAGE_ONLY));
      return;
    }
    cb(null, true);
  },
});

const createAlbumSchema = z.object({
  routeId: z.coerce.number().int().positive(),
  title: z.string().max(128).optional(),
});

const shareAlbumSchema = z.object({
  enabled: z.boolean(),
});

const applyExifSchema = z.object({
  photoIds: z.array(z.coerce.number().int().positive()).optional(),
});

const updatePhotoSchema = z
  .object({
    dayIndex: z.coerce.number().int().min(0).nullable().optional(),
    poiName: z.string().max(128).nullable().optional(),
    attractionId: z.coerce.number().int().positive().nullable().optional(),
    caption: z.string().max(512).nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'empty update' });

function parseAlbumId(raw: string): number | null {
  const id = parseInt(raw, 10);
  if (Number.isNaN(id) || id <= 0) return null;
  return id;
}

function resolveStoredUrl(
  req: import('express').Request,
  stored: string,
): string {
  const publicBase = resolvePublicBaseFromRequest(req);
  return resolvePublicAssetUrl(stored, { publicBase }) ?? stored;
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const albums = await listJourneyAlbumsForUser(req.auth!.userId);
    const publicBase = resolvePublicBaseFromRequest(req);
    const resolved = albums.map((album) =>
      resolveAlbumSummaryUrls(album, (stored) =>
        stored ? resolvePublicAssetUrl(stored, { publicBase }) : null,
      ),
    );
    success(res, { items: resolved });
  } catch (err) {
    console.error('[journey-albums/list]', err);
    return fail(res, ApiMessageKey.JOURNEY_ALBUM_LIST_FAILED, 500, 500);
  }
});

router.get('/photos', authMiddleware, async (req, res) => {
  try {
    const { page, pageSize } = parsePaginationQuery(req.query as Record<string, unknown>);
    const result = await listUserTravelPhotosPaginated(req.auth!.userId, page, pageSize);
    const publicBase = resolvePublicBaseFromRequest(req);
    success(res, {
      ...result,
      items: resolveAlbumPhotoUrls(result.items, (stored) => resolveStoredUrl(req, stored)),
    });
  } catch (err) {
    console.error('[journey-albums/photos]', err);
    return fail(res, ApiMessageKey.TRAVEL_PHOTO_LIST_FAILED, 500, 500);
  }
});

router.get('/by-route/:routeId', authMiddleware, async (req, res) => {
  try {
    const routeId = parseAlbumId(String(req.params.routeId));
    if (!routeId) {
      return fail(res, ApiMessageKey.PARAM_ERROR);
    }

    let summary = await getJourneyAlbumByRoute(req.auth!.userId, routeId);
    if (!summary) {
      summary = await createJourneyAlbum(req.auth!.userId, { routeId });
    }

    const detail = await getJourneyAlbumDetail(summary.id, req.auth!.userId);
    if (!detail) {
      return fail(res, ApiMessageKey.JOURNEY_ALBUM_NOT_FOUND, 404, 404);
    }

    success(res, resolveAlbumDetailUrls(detail, (stored) => resolveStoredUrl(req, stored)));
  } catch (err) {
    console.error('[journey-albums/by-route]', err);
    return failFromError(res, err, ApiMessageKey.JOURNEY_ALBUM_DETAIL_FAILED);
  }
});

router.post('/:id/share', authMiddleware, async (req, res) => {
  try {
    const albumId = parseAlbumId(String(req.params.id));
    if (!albumId) {
      return fail(res, ApiMessageKey.JOURNEY_ALBUM_INVALID_ID);
    }
    const parsed = shareAlbumSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, ApiMessageKey.PARAM_ERROR);
    }
    const state = await updateJourneyAlbumShare(albumId, req.auth!.userId, parsed.data.enabled);
    success(res, state, ApiMessageKey.JOURNEY_ALBUM_SHARE_UPDATED);
  } catch (err) {
    console.error('[journey-albums/share]', err);
    return failFromError(res, err, ApiMessageKey.JOURNEY_ALBUM_DETAIL_FAILED);
  }
});

router.post('/:id/photos/apply-exif-suggestions', authMiddleware, async (req, res) => {
  try {
    const albumId = parseAlbumId(String(req.params.id));
    if (!albumId) {
      return fail(res, ApiMessageKey.JOURNEY_ALBUM_INVALID_ID);
    }
    const parsed = applyExifSchema.safeParse(req.body ?? {});
    const photoIds = parsed.success ? parsed.data.photoIds : undefined;
    const result = await applyExifSuggestionsForAlbum(albumId, req.auth!.userId, photoIds);
    success(
      res,
      {
        ...result,
        photos: resolveAlbumPhotoUrls(result.photos, (stored) => resolveStoredUrl(req, stored)),
      },
      ApiMessageKey.TRAVEL_PHOTO_EXIF_APPLIED,
    );
  } catch (err) {
    console.error('[journey-albums/apply-exif]', err);
    return failFromError(res, err, ApiMessageKey.TRAVEL_PHOTO_UPDATE_FAILED);
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const albumId = parseAlbumId(String(req.params.id));
    if (!albumId) {
      return fail(res, ApiMessageKey.JOURNEY_ALBUM_INVALID_ID);
    }

    const detail = await getJourneyAlbumDetail(albumId, req.auth!.userId);
    if (!detail) {
      return fail(res, ApiMessageKey.JOURNEY_ALBUM_NOT_FOUND, 404, 404);
    }

    success(res, resolveAlbumDetailUrls(detail, (stored) => resolveStoredUrl(req, stored)));
  } catch (err) {
    console.error('[journey-albums/detail]', err);
    return fail(res, ApiMessageKey.JOURNEY_ALBUM_DETAIL_FAILED, 500, 500);
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const parsed = createAlbumSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? ApiMessageKey.PARAM_ERROR);
    }

    const album = await createJourneyAlbum(req.auth!.userId, parsed.data);
    const publicBase = resolvePublicBaseFromRequest(req);
    success(
      res,
      resolveAlbumSummaryUrls(album, (stored) =>
        stored ? resolvePublicAssetUrl(stored, { publicBase }) : null,
      ),
      ApiMessageKey.JOURNEY_ALBUM_CREATED,
    );
  } catch (err) {
    console.error('[journey-albums/create]', err);
    return failFromError(res, err, ApiMessageKey.JOURNEY_ALBUM_CREATE_FAILED);
  }
});

router.post('/:id/photos', authMiddleware, (req, res, next) => {
  photoUpload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return fail(res, ApiMessageKey.TRAVEL_PHOTO_FILE_TOO_LARGE);
      }
      const message = err instanceof Error ? err.message : ApiMessageKey.TRAVEL_PHOTO_UPLOAD_FAILED;
      return fail(res, message);
    }
    next();
  });
}, async (req, res) => {
  try {
    const albumId = parseAlbumId(String(req.params.id));
    if (!albumId) {
      return fail(res, ApiMessageKey.JOURNEY_ALBUM_INVALID_ID);
    }
    if (!req.file?.buffer) {
      return fail(res, ApiMessageKey.IMAGE_REQUIRED);
    }

    const dayIndexRaw = req.body.dayIndex;
    const dayIndex =
      dayIndexRaw === '' || dayIndexRaw == null
        ? null
        : Number.parseInt(String(dayIndexRaw), 10);

    const photo = await uploadTravelPhoto(albumId, req.auth!.userId, {
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      byteSize: req.file.size,
      dayIndex: Number.isNaN(dayIndex) ? null : dayIndex,
      poiName: typeof req.body.poiName === 'string' ? req.body.poiName : null,
      attractionId:
        req.body.attractionId != null && req.body.attractionId !== ''
          ? Number.parseInt(String(req.body.attractionId), 10)
          : null,
      caption: typeof req.body.caption === 'string' ? req.body.caption : null,
      sortOrder:
        req.body.sortOrder != null && req.body.sortOrder !== ''
          ? Number.parseInt(String(req.body.sortOrder), 10)
          : undefined,
    });

    success(
      res,
      resolveAlbumPhotoUrls([photo], (stored) => resolveStoredUrl(req, stored))[0],
      ApiMessageKey.TRAVEL_PHOTO_UPLOAD_SUCCESS,
    );
  } catch (err) {
    console.error('[journey-albums/upload]', err);
    return failFromError(res, err, ApiMessageKey.TRAVEL_PHOTO_UPLOAD_FAILED);
  }
});

router.patch('/:id/photos/:photoId', authMiddleware, async (req, res) => {
  try {
    const albumId = parseAlbumId(String(req.params.id));
    const photoId = parseAlbumId(String(req.params.photoId));
    if (!albumId || !photoId) {
      return fail(res, ApiMessageKey.PARAM_ERROR);
    }

    const parsed = updatePhotoSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? ApiMessageKey.PARAM_ERROR);
    }

    const photo = await updateTravelPhoto(albumId, photoId, req.auth!.userId, parsed.data);
    if (!photo) {
      return fail(res, ApiMessageKey.TRAVEL_PHOTO_NOT_FOUND, 404, 404);
    }

    success(
      res,
      resolveAlbumPhotoUrls([photo], (stored) => resolveStoredUrl(req, stored))[0],
      ApiMessageKey.TRAVEL_PHOTO_UPDATED,
    );
  } catch (err) {
    console.error('[journey-albums/update-photo]', err);
    return fail(res, ApiMessageKey.TRAVEL_PHOTO_UPDATE_FAILED, 500, 500);
  }
});

router.delete('/:id/photos/:photoId', authMiddleware, async (req, res) => {
  try {
    const albumId = parseAlbumId(String(req.params.id));
    const photoId = parseAlbumId(String(req.params.photoId));
    if (!albumId || !photoId) {
      return fail(res, ApiMessageKey.PARAM_ERROR);
    }

    const deleted = await deleteTravelPhoto(albumId, photoId, req.auth!.userId);
    if (!deleted) {
      return fail(res, ApiMessageKey.TRAVEL_PHOTO_NOT_FOUND, 404, 404);
    }

    success(res, { photoId }, ApiMessageKey.TRAVEL_PHOTO_DELETE_SUCCESS);
  } catch (err) {
    console.error('[journey-albums/delete-photo]', err);
    return fail(res, ApiMessageKey.TRAVEL_PHOTO_DELETE_FAILED, 500, 500);
  }
});

export default router;
