import { Router } from 'express';
import { z } from 'zod';
import { ApiMessageKey, BizOrgStatus } from '@douxing/shared';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePerm } from '../../middleware/admin.middleware.js';
import { fail, failFromError, success } from '../../utils/response.js';
import {
  getBizOrgDetailById,
  listBizOrgsForAdminPage,
  reviewBizOrg,
} from '../../services/marketplace/marketplace-org-onboard.service.js';
import { listBizOrgsForAdmin } from '../../services/marketplace/marketplace-org.service.js';
import {
  listServiceProvidersForAdminPage,
  reviewServiceProvider,
} from '../../services/marketplace/marketplace-provider.service.js';
import { listDemandsForAdminPage } from '../../services/marketplace/marketplace-demand.service.js';
import {
  parseDateRangeFilter,
  parseOptionalString,
} from '../../utils/admin-list-filter.js';
import { parsePaginationQuery } from '../../utils/pagination.js';
import { resolvePublicAssetUrl, resolvePublicBaseFromRequest } from '../../utils/public-asset-url.util.js';

const router = Router();

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reviewNote: z.string().max(1000).optional(),
});

/**
 * 将商户详情中的附件路径解析为对外 URL。
 *
 * @param req - Express 请求
 * @param detail - 商户详情
 * @returns 带 public URL 的详情
 */
function mapOrgDetailUrls(
  req: import('express').Request,
  detail: Awaited<ReturnType<typeof getBizOrgDetailById>>,
) {
  if (!detail) return detail;
  const publicBase = resolvePublicBaseFromRequest(req);
  return {
    ...detail,
    documents: detail.documents.map((doc) => ({
      ...doc,
      fileUrl: resolvePublicAssetUrl(doc.fileUrl, { publicBase }) ?? doc.fileUrl,
    })),
  };
}

router.get('/orgs', authMiddleware, async (req, res) => {
  if (!(await requirePerm(req, res, 'marketplace:org:list'))) return;

  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const keyword = parseOptionalString(req.query as Record<string, unknown>, 'keyword');
  const status = parseOptionalString(req.query as Record<string, unknown>, 'status');
  const orgType = parseOptionalString(req.query as Record<string, unknown>, 'orgType');

  try {
    if (req.query.page != null || req.query.pageSize != null) {
      const result = await listBizOrgsForAdminPage({
        page: pagination.page,
        pageSize: pagination.pageSize,
        keyword,
        status,
        orgType,
      });
      success(res, result);
      return;
    }

    const items = await listBizOrgsForAdmin();
    success(res, { items });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.get('/orgs/pending', authMiddleware, async (req, res) => {
  if (!(await requirePerm(req, res, 'marketplace:org:audit'))) return;

  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const keyword = parseOptionalString(req.query as Record<string, unknown>, 'keyword');
  const orgType = parseOptionalString(req.query as Record<string, unknown>, 'orgType');
  parseDateRangeFilter(req.query as Record<string, unknown>);

  try {
    const result = await listBizOrgsForAdminPage({
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: BizOrgStatus.PENDING,
      keyword,
      orgType,
    });
    success(res, result);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.get('/orgs/:id', authMiddleware, async (req, res) => {
  if (!(await requirePerm(req, res, 'marketplace:org:list', 'marketplace:org:audit'))) return;

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
    success(res, mapOrgDetailUrls(req, detail));
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.patch('/orgs/:id/review', authMiddleware, async (req, res) => {
  const adminUser = await requirePerm(req, res, 'marketplace:org:audit');
  if (!adminUser) return;

  const orgId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(orgId) || orgId <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_ORG_REVIEW_INVALID, 400, 400);
    return;
  }

  try {
    const detail = await reviewBizOrg(orgId, adminUser.id, parsed.data);
    success(res, mapOrgDetailUrls(req, detail));
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.get('/providers/pending', authMiddleware, async (req, res) => {
  if (!(await requirePerm(req, res, 'marketplace:org:audit'))) return;

  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const keyword = parseOptionalString(req.query as Record<string, unknown>, 'keyword');
  const providerType = parseOptionalString(req.query as Record<string, unknown>, 'providerType');

  try {
    const result = await listServiceProvidersForAdminPage({
      page: pagination.page,
      pageSize: pagination.pageSize,
      certStatus: 'pending',
      keyword,
      providerType,
    });
    success(res, result);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.patch('/providers/:id/review', authMiddleware, async (req, res) => {
  const adminUser = await requirePerm(req, res, 'marketplace:org:audit');
  if (!adminUser) return;

  const providerId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(providerId) || providerId <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_ORG_REVIEW_INVALID, 400, 400);
    return;
  }

  try {
    const provider = await reviewServiceProvider(providerId, adminUser.id, parsed.data);
    success(res, { provider });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.get('/demands', authMiddleware, async (req, res) => {
  if (!(await requirePerm(req, res, 'marketplace:demand:list'))) return;

  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const keyword = parseOptionalString(req.query as Record<string, unknown>, 'keyword');
  const status = parseOptionalString(req.query as Record<string, unknown>, 'status');
  const categoryCode = parseOptionalString(req.query as Record<string, unknown>, 'categoryCode');
  const destination = parseOptionalString(req.query as Record<string, unknown>, 'destination');
  parseDateRangeFilter(req.query as Record<string, unknown>);

  try {
    const result = await listDemandsForAdminPage({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword,
      status,
      categoryCode,
      destination,
    });
    success(res, result);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

export default router;
