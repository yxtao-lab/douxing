import { Router } from 'express';
import { z } from 'zod';
import { ApiMessageKey, ProductStatus } from '@douxing/shared';
import { authMiddleware } from '../../middleware/auth.js';
import { fail, failFromError, success } from '../../utils/response.js';
import {
  createProduct,
  getProductDetailForViewer,
  listOnSaleProducts,
  listProductsByOrg,
  setProductStatus,
  updateProduct,
} from '../../services/marketplace/marketplace-product.service.js';
import { createOrderFromProduct } from '../../services/marketplace/marketplace-order.service.js';

const router = Router();

const skuSchema = z.object({
  name: z.string().min(1).max(128),
  price: z.string().min(1).max(32),
  stock: z.number().int().min(0).max(1_000_000),
  sortOrder: z.number().int().optional(),
});

const productInputSchema = z.object({
  categoryCode: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  coverUrl: z.string().max(512).optional(),
  destination: z.string().max(128).optional(),
  skus: z.array(skuSchema).min(1).max(20),
});

const createBodySchema = productInputSchema.extend({
  orgId: z.number().int().positive(),
});

const statusBodySchema = z.object({
  status: z.enum([ProductStatus.ON_SALE, ProductStatus.OFF_SALE]),
});

const purchaseBodySchema = z.object({
  skuId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(99).optional(),
});

/**
 * 公开标品大厅（仅上架）。
 *
 * @route GET /api/marketplace/products
 */
router.get('/', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const result = await listOnSaleProducts({
      page,
      pageSize,
      categoryCode: typeof req.query.categoryCode === 'string' ? req.query.categoryCode : undefined,
      destination: typeof req.query.destination === 'string' ? req.query.destination : undefined,
      keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
      orgId: req.query.orgId ? Number(req.query.orgId) : undefined,
    });
    success(res, result);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

/**
 * 列出当前用户某商户下的全部标品（含草稿）。
 *
 * @route GET /api/marketplace/products/mine
 */
router.get('/mine', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }
  const orgId = Number(req.query.orgId);
  if (!Number.isInteger(orgId) || orgId <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }
  try {
    const items = await listProductsByOrg(req.auth.userId, orgId);
    success(res, { items });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

/**
 * 创建标品（默认草稿）。
 *
 * @route POST /api/marketplace/products
 */
router.post('/', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }
  const parsed = createBodySchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_PRODUCT_INVALID, 400, 400);
    return;
  }
  try {
    const { orgId, ...input } = parsed.data;
    const detail = await createProduct(req.auth.userId, orgId, input);
    success(res, detail);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

/**
 * 读取标品详情。
 *
 * @route GET /api/marketplace/products/:id
 */
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }
  try {
    const detail = await getProductDetailForViewer(id, req.auth?.userId);
    success(res, detail);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

/**
 * 更新标品（全量替换 SKU）。
 *
 * @route PUT /api/marketplace/products/:id
 */
router.put('/:id', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }
  const parsed = productInputSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_PRODUCT_INVALID, 400, 400);
    return;
  }
  try {
    const detail = await updateProduct(id, req.auth.userId, parsed.data);
    success(res, detail);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

/**
 * 上架 / 下架标品。
 *
 * @route PATCH /api/marketplace/products/:id/status
 */
router.patch('/:id/status', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }
  const parsed = statusBodySchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_PRODUCT_STATUS_INVALID, 400, 400);
    return;
  }
  try {
    const detail = await setProductStatus(id, req.auth.userId, parsed.data.status);
    success(res, detail);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

/**
 * 标品直购下单（模拟支付前）。
 *
 * @route POST /api/marketplace/products/:id/purchase
 */
router.post('/:id/purchase', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }
  const parsed = purchaseBodySchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_PRODUCT_PURCHASE_INVALID, 400, 400);
    return;
  }
  try {
    const order = await createOrderFromProduct(id, req.auth.userId, parsed.data);
    success(res, order);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

export default router;
