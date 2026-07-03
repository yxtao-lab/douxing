import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ApiMessageKey, ROUTE_VIDEO_MAX_FILE_BYTES } from '@douxing/shared';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail, failFromError } from '../utils/response.js';
import { resolvePublicAssetUrl } from '../utils/public-asset-url.util.js';
import {
  deleteRouteMedia,
  listRouteMedia,
  uploadRouteMedia,
} from '../services/route-media.service.js';

const router = Router({ mergeParams: true });

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ROUTE_VIDEO_MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) {
      cb(new Error(ApiMessageKey.ROUTE_VIDEO_REQUIRED));
      return;
    }
    cb(null, true);
  },
});

const uploadBodySchema = z.object({
  scope: z.enum(['route', 'poi']),
  durationSec: z.coerce.number().int().min(1).max(60),
  dayIndex: z.coerce.number().int().min(0).max(29).optional(),
  attractionId: z.coerce.number().int().positive().optional(),
  poiName: z.string().min(1).max(128).optional(),
  coverUrl: z.string().max(512).optional(),
});

/**
 * 列出路线绑定视频；作者可见全部状态，他人仅已通过审核。
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const routeId = Number.parseInt(String(req.params.routeId), 10);
    if (Number.isNaN(routeId)) {
      return fail(res, ApiMessageKey.INVALID_ROUTE_ID);
    }
    const items = await listRouteMedia(routeId, req.auth!.userId);
    const publicBase = `${req.protocol}://${req.get('host')}`;
    const resolved = items.map((item) => ({
      ...item,
      videoUrl: resolvePublicAssetUrl(item.videoUrl, { publicBase }) ?? item.videoUrl,
      coverUrl: item.coverUrl
        ? resolvePublicAssetUrl(item.coverUrl, { publicBase })
        : item.coverUrl,
    }));
    success(res, resolved);
  } catch (err) {
    console.error('[route-media/list]', err);
    return failFromError(res, err, ApiMessageKey.ROUTE_MEDIA_LIST_FAILED);
  }
});

/**
 * 上传路线或 POI 绑定短视频（≤60s）。
 */
router.post('/', authMiddleware, (req, res, next) => {
  videoUpload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return fail(res, ApiMessageKey.ROUTE_MEDIA_FILE_TOO_LARGE);
      }
      const message =
        err instanceof Error && err.message.startsWith('api.')
          ? err.message
          : ApiMessageKey.ROUTE_MEDIA_UPLOAD_FAILED;
      return fail(res, message);
    }
    next();
  });
}, async (req, res) => {
  try {
    const routeId = Number.parseInt(String(req.params.routeId), 10);
    if (Number.isNaN(routeId)) {
      return fail(res, ApiMessageKey.INVALID_ROUTE_ID);
    }
    if (!req.file?.buffer) {
      return fail(res, ApiMessageKey.ROUTE_VIDEO_REQUIRED);
    }

    const parsed = uploadBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return fail(res, ApiMessageKey.VALIDATION_ERROR, 1, 400);
    }

    const media = await uploadRouteMedia(routeId, req.auth!.userId, {
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      byteSize: req.file.size,
      durationSec: parsed.data.durationSec,
      scope: parsed.data.scope,
      dayIndex: parsed.data.dayIndex,
      attractionId: parsed.data.attractionId,
      poiName: parsed.data.poiName,
      coverUrl: parsed.data.coverUrl,
    });

    const publicBase = `${req.protocol}://${req.get('host')}`;
    success(
      res,
      {
        ...media,
        videoUrl: resolvePublicAssetUrl(media.videoUrl, { publicBase }) ?? media.videoUrl,
        coverUrl: media.coverUrl
          ? resolvePublicAssetUrl(media.coverUrl, { publicBase })
          : media.coverUrl,
      },
      ApiMessageKey.ROUTE_MEDIA_UPLOAD_SUCCESS,
    );
  } catch (err) {
    console.error('[route-media/upload]', err);
    return failFromError(res, err, ApiMessageKey.ROUTE_MEDIA_UPLOAD_FAILED);
  }
});

/**
 * 删除本人上传的路线视频。
 */
router.delete('/:mediaId', authMiddleware, async (req, res) => {
  try {
    const routeId = Number.parseInt(String(req.params.routeId), 10);
    const mediaId = Number.parseInt(String(req.params.mediaId), 10);
    if (Number.isNaN(routeId) || Number.isNaN(mediaId)) {
      return fail(res, ApiMessageKey.PARAM_ERROR);
    }
    await deleteRouteMedia(routeId, mediaId, req.auth!.userId);
    success(res, { deleted: true }, ApiMessageKey.ROUTE_MEDIA_DELETE_SUCCESS);
  } catch (err) {
    console.error('[route-media/delete]', err);
    return failFromError(res, err, ApiMessageKey.ROUTE_MEDIA_DELETE_FAILED);
  }
});

export default router;
