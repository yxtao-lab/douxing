import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.js';
import { fail, failFromError, success } from '../../utils/response.js';
import { ApiMessageKey, BudgetType, InvoiceTitleType } from '@douxing/shared';
import {
  createDemand,
  getDemandByIdForUser,
  getDemandByIdForViewer,
  listDemandsByUser,
  listPublishedDemands,
  publishDemand,
  updateDemand,
} from '../../services/marketplace/marketplace-demand.service.js';
import {
  createDemandQuote,
  listQuotesForDemand,
} from '../../services/marketplace/marketplace-quote.service.js';
import { selectQuoteAndCreateOrder } from '../../services/marketplace/marketplace-order.service.js';
import { parsePaginationQuery } from '../../utils/pagination.js';
import { parseOptionalString } from '../../utils/admin-list-filter.js';

const router = Router();

const invoiceInfoSchema = z
  .object({
    titleType: z.enum([InvoiceTitleType.PERSONAL, InvoiceTitleType.COMPANY]),
    title: z.string().min(1).max(128),
    taxNo: z.string().max(64).optional(),
    address: z.string().max(256).optional(),
    phone: z.string().max(32).optional(),
    bankName: z.string().max(128).optional(),
    bankAccount: z.string().max(64).optional(),
  })
  .nullable();

const demandInputSchema = z.object({
  categoryCode: z.string().min(1).max(64),
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  destination: z.string().max(128).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  budgetMin: z.string().optional(),
  budgetMax: z.string().optional(),
  budgetType: z.enum([BudgetType.FIXED, BudgetType.RANGE, BudgetType.NEGOTIABLE]).optional(),
  routeId: z.number().int().positive().optional(),
  /** 团体发单主体；传入则创建为 `publisher_type=group` */
  publisherGroupId: z.number().int().positive().optional(),
  /** 预计人数 */
  headcount: z.number().int().min(1).max(100_000).nullable().optional(),
  /** 发票抬头；`null` 表示清空 */
  invoiceInfo: invoiceInfoSchema.optional(),
});

const quoteSchema = z.object({
  amount: z.string().min(1),
  proposalText: z.string().max(5000).optional(),
  orgId: z.number().int().positive().optional(),
});

const selectQuoteSchema = z.object({
  quoteId: z.number().int().positive(),
});

const publishSchema = z.object({
  action: z.literal('publish'),
});

/**
 * 解析路径中的需求单 ID。
 *
 * @param raw - 路由参数原始字符串
 * @returns 正整数 ID；非法时 `null`
 */
function parseDemandId(raw: string): number | null {
  const id = parseInt(raw, 10);
  if (Number.isNaN(id) || id <= 0) return null;
  return id;
}

router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const items = await listDemandsByUser(userId);
    success(res, { items });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.get('/', authMiddleware, async (req, res) => {
  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const categoryCode = parseOptionalString(req.query as Record<string, unknown>, 'categoryCode');
  const destination = parseOptionalString(req.query as Record<string, unknown>, 'destination');
  const keyword = parseOptionalString(req.query as Record<string, unknown>, 'keyword');

  try {
    const result = await listPublishedDemands({
      page: pagination.page,
      pageSize: pagination.pageSize,
      categoryCode,
      destination,
      keyword,
    });
    success(res, result);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.post('/', authMiddleware, async (req, res) => {
  const parsed = demandInputSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_DEMAND_INVALID, 400, 400);
    return;
  }

  try {
    const demand = await createDemand(req.auth!.userId, parsed.data);
    success(res, demand, 201);
  } catch (err) {
    failFromError(res, err);
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseDemandId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  try {
    const demand = await getDemandByIdForViewer(id, req.auth!.userId);
    success(res, demand);
  } catch (err) {
    failFromError(res, err);
  }
});

router.patch('/:id', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseDemandId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  const publishParsed = publishSchema.safeParse(req.body);
  if (publishParsed.success) {
    try {
      const demand = await publishDemand(id, req.auth!.userId);
      success(res, demand);
      return;
    } catch (err) {
      failFromError(res, err);
      return;
    }
  }

  const parsed = demandInputSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_DEMAND_INVALID, 400, 400);
    return;
  }

  try {
    const demand = await updateDemand(id, req.auth!.userId, parsed.data);
    success(res, demand);
  } catch (err) {
    failFromError(res, err);
  }
});

router.get('/:id/quotes', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseDemandId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  try {
    await getDemandByIdForUser(id, req.auth!.userId);
    const items = await listQuotesForDemand(id);
    success(res, { items });
  } catch (err) {
    failFromError(res, err);
  }
});

router.post('/:id/quotes', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseDemandId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_QUOTE_INVALID, 400, 400);
    return;
  }

  try {
    const quote = await createDemandQuote(id, req.auth!.userId, parsed.data);
    success(res, quote, 201);
  } catch (err) {
    failFromError(res, err);
  }
});

router.post('/:id/select-quote', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseDemandId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  const parsed = selectQuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_QUOTE_INVALID, 400, 400);
    return;
  }

  try {
    const order = await selectQuoteAndCreateOrder(id, req.auth!.userId, parsed.data);
    success(res, order, 201);
  } catch (err) {
    failFromError(res, err);
  }
});

export default router;
