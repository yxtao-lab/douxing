import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.js';
import { fail, failFromError, success } from '../../utils/response.js';
import { ApiMessageKey, ServiceOrderReportType, ServiceOrderStatus } from '@douxing/shared';
import {
  advanceServiceOrderStatus,
  assignGuideToServiceOrder,
  cancelServiceOrder,
  createServiceOrderPrepay,
  getOrderByIdForUser,
  isUserSellerForOrder,
  listServiceOrdersByBuyer,
  listServiceOrdersBySeller,
  payMockServiceOrder,
  requestServiceOrderPay,
  requestServiceOrderRefundPlaceholder,
} from '../../services/marketplace/marketplace-order.service.js';
import {
  createServiceOrderReport,
  listServiceOrderReports,
} from '../../services/marketplace/marketplace-order-report.service.js';
import {
  MARKETPLACE_DOC_MAX_BYTES,
  saveMarketplaceDocumentLocal,
} from '../../utils/marketplace-document-upload.util.js';
import { resolvePublicAssetUrl, resolvePublicBaseFromRequest } from '../../utils/public-asset-url.util.js';
import reviewsRouter from './reviews.js';
import disputesRouter from './disputes.js';

const router = Router();

const statusSchema = z.object({
  status: z.enum([
    ServiceOrderStatus.IN_PROGRESS,
    ServiceOrderStatus.DELIVERED,
    ServiceOrderStatus.CONFIRMED,
  ]),
});

const assignSchema = z.object({
  guideUserId: z.number().int().positive().nullable(),
});

const reportSchema = z.object({
  reportType: z.enum([ServiceOrderReportType.CHECKIN, ServiceOrderReportType.REPORT]),
  content: z.string().max(4000).optional(),
  photos: z.array(z.string().min(1).max(512)).max(9).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  placeName: z.string().max(256).optional(),
});

const reportPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MARKETPLACE_DOC_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error(ApiMessageKey.MARKETPLACE_DOCUMENT_INVALID));
      return;
    }
    cb(null, true);
  },
});

/**
 * 解析路径中的订单 ID。
 *
 * @param raw - 路由参数原始字符串
 * @returns 正整数 ID；非法时 `null`
 */
function parseOrderId(raw: string): number | null {
  const id = parseInt(raw, 10);
  if (Number.isNaN(id) || id <= 0) return null;
  return id;
}

router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const items = await listServiceOrdersByBuyer(req.auth!.userId);
    success(res, { items });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.get('/seller', authMiddleware, async (req, res) => {
  try {
    const items = await listServiceOrdersBySeller(req.auth!.userId);
    success(res, { items });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseOrderId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  try {
    const order = await getOrderByIdForUser(id, req.auth!.userId);
    success(res, order);
  } catch (err) {
    failFromError(res, err);
  }
});

const prepaySchema = z.object({
  wxCode: z.string().min(1).optional(),
});

router.post('/:id/pay-mock', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseOrderId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  try {
    const order = await payMockServiceOrder(id, req.auth!.userId);
    success(res, order);
  } catch (err) {
    failFromError(res, err);
  }
});

/**
 * 服务订单预下单：mock 返回渠道信息；微信返回 JSAPI 调起参数。
 *
 * @route POST /api/marketplace/orders/:id/prepay
 */
router.post('/:id/prepay', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseOrderId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  const parsed = prepaySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  try {
    const result = await createServiceOrderPrepay(id, req.auth!.userId, parsed.data.wxCode);
    if ('error' in result) {
      fail(res, result.error);
      return;
    }
    success(res, result.prepay);
  } catch (err) {
    failFromError(res, err);
  }
});

/**
 * 模拟支付确认（与模块 A `/orders/:id/pay` 对齐）：将 `pending_pay` 标为 `paid`。
 * 微信真付须先 `prepay`，由 `POST /payments/wechat/notify` 履约。
 *
 * @route POST /api/marketplace/orders/:id/pay
 */
router.post('/:id/pay', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseOrderId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  try {
    const order = await requestServiceOrderPay(id, req.auth!.userId);
    success(res, order);
  } catch (err) {
    failFromError(res, err);
  }
});

/**
 * 取消待支付订单。
 *
 * @route POST /api/marketplace/orders/:id/cancel
 */
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseOrderId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  try {
    const order = await cancelServiceOrder(id, req.auth!.userId);
    success(res, order);
  } catch (err) {
    failFromError(res, err);
  }
});

/**
 * 退款占位（不调微信）。
 *
 * @route POST /api/marketplace/orders/:id/refund
 */
router.post('/:id/refund', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseOrderId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  try {
    const result = await requestServiceOrderRefundPlaceholder(id, req.auth!.userId);
    success(res, result);
  } catch (err) {
    failFromError(res, err);
  }
});

router.patch('/:id/status', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseOrderId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_ORDER_STATUS_INVALID, 400, 400);
    return;
  }

  try {
    const order = await advanceServiceOrderStatus(id, req.auth!.userId, parsed.data);
    success(res, order);
  } catch (err) {
    failFromError(res, err);
  }
});

/**
 * 指派或清除履约领队（仅商户 owner/admin）。
 *
 * @route PATCH /api/marketplace/orders/:id/assign
 */
router.patch('/:id/assign', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseOrderId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_ORDER_ASSIGN_INVALID, 400, 400);
    return;
  }

  try {
    const order = await assignGuideToServiceOrder(id, req.auth!.userId, parsed.data);
    success(res, order);
  } catch (err) {
    failFromError(res, err);
  }
});

/**
 * 履约汇报时间线（买方或卖方可读）。
 *
 * @route GET /api/marketplace/orders/:id/reports
 */
router.get('/:id/reports', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseOrderId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  try {
    const items = await listServiceOrderReports(id, req.auth!.userId);
    success(res, { items });
  } catch (err) {
    failFromError(res, err);
  }
});

/**
 * 创建履约汇报（签到 / 图文；仅卖方侧）。
 *
 * @route POST /api/marketplace/orders/:id/reports
 */
router.post('/:id/reports', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseOrderId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_ORDER_REPORT_INVALID, 400, 400);
    return;
  }

  try {
    const report = await createServiceOrderReport(id, req.auth!.userId, parsed.data);
    success(res, report);
  } catch (err) {
    failFromError(res, err);
  }
});

/**
 * 上传履约汇报图片（仅图片）。
 *
 * @route POST /api/marketplace/orders/:id/reports/photos
 */
router.post('/:id/reports/photos', authMiddleware, (req, res) => {
  const rawId = req.params.id;
  const id = parseOrderId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  reportPhotoUpload.single('file')(req, res, async (err) => {
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
      const order = await getOrderByIdForUser(id, req.auth.userId);
      const ok = await isUserSellerForOrder(
        req.auth.userId,
        order.sellerOrgId,
        order.sellerProviderUserId,
        order.assignedGuideUserId,
      );
      if (!ok) {
        fail(res, ApiMessageKey.MARKETPLACE_ORDER_REPORT_FORBIDDEN, 403, 403);
        return;
      }

      const storedPath = saveMarketplaceDocumentLocal(
        req.auth.userId,
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype,
      );
      const publicBase = resolvePublicBaseFromRequest(req);
      success(res, {
        fileUrl: storedPath,
        publicUrl: resolvePublicAssetUrl(storedPath, { publicBase }) ?? storedPath,
        fileName: req.file.originalname,
      });
    } catch (uploadErr) {
      failFromError(res, uploadErr, ApiMessageKey.MARKETPLACE_DOCUMENT_UPLOAD_FAILED);
    }
  });
});

router.use('/:id/reviews', reviewsRouter);
router.use('/:id/disputes', disputesRouter);

export default router;
