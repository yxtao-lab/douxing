import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  ApiMessageKey,
  BizOrgType,
  OrgDocumentType,
  ProviderType,
} from '@douxing/shared';
import { authMiddleware } from '../../middleware/auth.js';
import { fail, failFromError, success } from '../../utils/response.js';
import {
  applyBizOrg,
  getBizOrgDetailById,
  listOrgMembersForActor,
  listOrgMembershipsByUser,
} from '../../services/marketplace/marketplace-org-onboard.service.js';
import {
  MARKETPLACE_DOC_MAX_BYTES,
  saveMarketplaceDocumentLocal,
} from '../../utils/marketplace-document-upload.util.js';
import { resolvePublicAssetUrl, resolvePublicBaseFromRequest } from '../../utils/public-asset-url.util.js';

const router = Router();

const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MARKETPLACE_DOC_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed =
      file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    if (!allowed) {
      cb(new Error(ApiMessageKey.MARKETPLACE_DOCUMENT_INVALID));
      return;
    }
    cb(null, true);
  },
});

const applySchema = z.object({
  name: z.string().min(1).max(128),
  orgType: z.enum([
    BizOrgType.TRAVEL_AGENCY,
    BizOrgType.PHOTO_STUDIO,
    BizOrgType.GUIDE_STUDIO,
    BizOrgType.OUTDOOR_CLUB,
    BizOrgType.OTHER,
  ]),
  licenseNo: z.string().max(64).optional(),
  contactPhone: z.string().max(32).optional(),
  description: z.string().max(2000).optional(),
  documents: z
    .array(
      z.object({
        docType: z.enum([OrgDocumentType.LICENSE, OrgDocumentType.PORTFOLIO]),
        fileUrl: z.string().min(1).max(512),
        fileName: z.string().max(256).optional(),
      }),
    )
    .min(1),
});

/**
 * 将存储路径解析为对外可访问 URL。
 *
 * @param req - Express 请求
 * @param stored - 数据库存储路径
 * @returns 完整 URL 或原路径
 */
function resolveDocUrl(req: import('express').Request, stored: string): string {
  const publicBase = resolvePublicBaseFromRequest(req);
  return resolvePublicAssetUrl(stored, { publicBase }) ?? stored;
}

router.post('/documents/upload', authMiddleware, (req, res) => {
  docUpload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        fail(res, ApiMessageKey.MARKETPLACE_DOCUMENT_INVALID, 400, 400);
        return;
      }
      failFromError(res, err, ApiMessageKey.MARKETPLACE_DOCUMENT_UPLOAD_FAILED);
      return;
    }

    if (!req.auth || !req.file) {
      fail(res, ApiMessageKey.MARKETPLACE_DOCUMENT_INVALID, 400, 400);
      return;
    }

    try {
      const storedPath = saveMarketplaceDocumentLocal(
        req.auth.userId,
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype,
      );
      success(res, {
        fileUrl: storedPath,
        publicUrl: resolveDocUrl(req, storedPath),
        fileName: req.file.originalname,
      });
    } catch (uploadErr) {
      failFromError(res, uploadErr, ApiMessageKey.MARKETPLACE_DOCUMENT_UPLOAD_FAILED);
    }
  });
});

router.post('/apply', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_ORG_APPLY_INVALID, 400, 400);
    return;
  }

  try {
    const detail = await applyBizOrg(req.auth.userId, parsed.data);
    const payload = {
      ...detail,
      documents: detail.documents.map((doc) => ({
        ...doc,
        fileUrl: resolveDocUrl(req, doc.fileUrl),
      })),
    };
    success(res, payload);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.get('/mine', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  try {
    const memberships = await listOrgMembershipsByUser(req.auth.userId);
    success(res, { items: memberships });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.get('/:id/members', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  const orgId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(orgId) || orgId <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  try {
    const items = await listOrgMembersForActor(orgId, req.auth.userId);
    success(res, { items });
  } catch (err) {
    failFromError(res, err);
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  const orgId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(orgId) || orgId <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  try {
    const detail = await getBizOrgDetailById(orgId);
    if (!detail) {
      fail(res, ApiMessageKey.MARKETPLACE_ORG_NOT_FOUND, 404, 404);
      return;
    }
    const payload = {
      ...detail,
      documents: detail.documents.map((doc) => ({
        ...doc,
        fileUrl: resolveDocUrl(req, doc.fileUrl),
      })),
    };
    success(res, payload);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

export default router;
