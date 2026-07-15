import { and, desc, eq, inArray, ne, or } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  BizOrgStatus,
  DEFAULT_PLATFORM_FEE_RATE,
  DemandStatus,
  ProductStatus,
  QuoteStatus,
  ServiceOrderStatus,
  type DemandSelectQuoteInput,
  type ServiceOrderDetail,
  type ServiceOrderRefundPlaceholder,
  type ServiceOrderStatusInput,
  type ServiceOrderSummary,
  type ServiceProductPurchaseInput,
} from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { bizOrg } from '../../db/schema/marketplace-biz-org.js';
import { demandQuote, serviceDemand } from '../../db/schema/marketplace-demand.js';
import { serviceOrder } from '../../db/schema/marketplace-order.js';
import { getDemandById, getDemandByIdForUser } from './marketplace-demand.service.js';
import { generateServiceOrderNo } from './marketplace-org.service.js';
import { getOrgRoleForUser, listOrgMembershipsByUser } from './marketplace-org-onboard.service.js';
import { getQuoteRowById } from './marketplace-quote.service.js';
import { applyCreditForOrderConfirmed } from './marketplace-credit.service.js';
import {
  decreaseSkuStock,
  getProductDetailById,
  getSkuRowById,
  increaseSkuStock,
} from './marketplace-product.service.js';
import { createPendingSettlementForOrder } from './marketplace-settlement.service.js';
import { getPaymentMode } from '../../config/payment.js';

const DEFAULT_PLATFORM_FEE_RATE_LOCAL = DEFAULT_PLATFORM_FEE_RATE;

/** 订单状态合法后继映射（取消单独走 cancelServiceOrder） */
const ORDER_STATUS_NEXT: Partial<Record<string, string>> = {
  [ServiceOrderStatus.PENDING_PAY]: ServiceOrderStatus.PAID,
  [ServiceOrderStatus.PAID]: ServiceOrderStatus.IN_PROGRESS,
  [ServiceOrderStatus.IN_PROGRESS]: ServiceOrderStatus.DELIVERED,
  [ServiceOrderStatus.DELIVERED]: ServiceOrderStatus.CONFIRMED,
};

/**
 * 将订单行映射为摘要 DTO。
 *
 * @param row - `service_order` 表行
 * @returns 订单摘要
 */
function toOrderSummary(row: typeof serviceOrder.$inferSelect): ServiceOrderSummary {
  return {
    id: row.id,
    orderNo: row.orderNo,
    demandId: row.demandId ?? null,
    quoteId: row.quoteId ?? null,
    productId: row.productId ?? null,
    skuId: row.skuId ?? null,
    buyerUserId: row.buyerUserId,
    sellerOrgId: row.sellerOrgId,
    sellerProviderUserId: row.sellerProviderUserId,
    totalAmount: String(row.totalAmount),
    platformFee: String(row.platformFee),
    status: row.status as ServiceOrderSummary['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 将订单行映射为详情 DTO。
 *
 * @param row - `service_order` 表行
 * @param demandTitle - 关联需求标题；直购为 `null`
 * @param demandNo - 关联需求单号；直购为 `null`
 * @param productTitle - 直购标品标题；发单成单为 `null`
 * @returns 订单详情
 */
function toOrderDetail(
  row: typeof serviceOrder.$inferSelect,
  demandTitle: string | null,
  demandNo: string | null,
  productTitle: string | null = null,
): ServiceOrderDetail {
  return {
    ...toOrderSummary(row),
    demandTitle,
    demandNo,
    productTitle,
  };
}

/**
 * 组装订单详情（按发单或直购补全标题）。
 *
 * @param row - 订单行
 * @returns 订单详情
 */
async function buildOrderDetail(row: typeof serviceOrder.$inferSelect): Promise<ServiceOrderDetail> {
  let demandTitle: string | null = null;
  let demandNo: string | null = null;
  let productTitle: string | null = null;

  if (row.demandId != null) {
    const demand = await getDemandById(row.demandId);
    demandTitle = demand?.title ?? null;
    demandNo = demand?.demandNo ?? null;
  }
  if (row.productId != null) {
    const product = await getProductDetailById(row.productId);
    productTitle = product?.title ?? null;
  }

  return toOrderDetail(row, demandTitle, demandNo, productTitle);
}

/**
 * 计算平台抽佣金额。
 *
 * @param totalAmount - 订单总金额字符串
 * @param rate - 抽佣比例，默认 5%
 * @returns 抽佣金额字符串（两位小数）
 */
export function calcPlatformFee(
  totalAmount: string,
  rate = DEFAULT_PLATFORM_FEE_RATE_LOCAL,
): string {
  const total = Number(totalAmount);
  if (!Number.isFinite(total) || total <= 0) return '0.00';
  const safeRate = Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : DEFAULT_PLATFORM_FEE_RATE_LOCAL;
  return (total * safeRate).toFixed(2);
}

/**
 * 解析商户结算配置中的抽佣比例；无效或缺失时回落默认值。
 *
 * @param orgId - 商户 ID；个人卖方为 `null` 时用默认费率
 * @returns 抽佣比例 0～1
 */
export async function resolvePlatformFeeRate(orgId: number | null): Promise<number> {
  if (orgId == null) {
    return DEFAULT_PLATFORM_FEE_RATE_LOCAL;
  }
  const db = getDb();
  const rows = await db
    .select({ settlementConfig: bizOrg.settlementConfig })
    .from(bizOrg)
    .where(eq(bizOrg.id, orgId))
    .limit(1);
  const rate = rows[0]?.settlementConfig?.platformFeeRate;
  if (typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate <= 1) {
    return rate;
  }
  return DEFAULT_PLATFORM_FEE_RATE_LOCAL;
}

/**
 * 发单方选定报价并生成待支付服务订单。
 *
 * @param demandId - 需求单 ID
 * @param userId - 发单方用户 ID
 * @param input - 含 `quoteId` 的选定入参
 * @returns 新建服务订单详情
 * @throws {ApiError} 需求/报价状态非法或无权操作
 */
export async function selectQuoteAndCreateOrder(
  demandId: number,
  userId: number,
  input: DemandSelectQuoteInput,
): Promise<ServiceOrderDetail> {
  const demand = await getDemandByIdForUser(demandId, userId);
  if (demand.status !== DemandStatus.PUBLISHED && demand.status !== DemandStatus.QUOTING) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DEMAND_STATUS_INVALID);
  }

  const quoteRow = await getQuoteRowById(input.quoteId);
  if (!quoteRow || quoteRow.demandId !== demandId) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_QUOTE_NOT_FOUND);
  }
  if (quoteRow.status !== QuoteStatus.PENDING) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_QUOTE_INVALID);
  }

  const db = getDb();
  const orderNo = generateServiceOrderNo();
  const totalAmount = String(quoteRow.amount);
  const feeRate = await resolvePlatformFeeRate(quoteRow.orgId);
  const platformFee = calcPlatformFee(totalAmount, feeRate);

  const [orderResult] = await db.insert(serviceOrder).values({
    orderNo,
    demandId,
    quoteId: quoteRow.id,
    buyerUserId: userId,
    sellerOrgId: quoteRow.orgId,
    sellerProviderUserId: quoteRow.providerUserId,
    totalAmount,
    platformFee,
    status: ServiceOrderStatus.PENDING_PAY,
  });
  const orderId = Number(orderResult.insertId);

  await db
    .update(demandQuote)
    .set({ status: QuoteStatus.ACCEPTED })
    .where(eq(demandQuote.id, quoteRow.id));

  await db
    .update(demandQuote)
    .set({ status: QuoteStatus.REJECTED })
    .where(and(eq(demandQuote.demandId, demandId), ne(demandQuote.id, quoteRow.id)));

  await db
    .update(serviceDemand)
    .set({ status: DemandStatus.SELECTED })
    .where(eq(serviceDemand.id, demandId));

  const orderRows = await db.select().from(serviceOrder).where(eq(serviceOrder.id, orderId)).limit(1);
  const orderRow = orderRows[0]!;
  return toOrderDetail(orderRow, demand.title, demand.demandNo, null);
}

/**
 * 标品直购：不经需求/报价，直接生成待支付订单并扣减库存。
 *
 * @param productId - 标品 ID
 * @param userId - 买方用户 ID
 * @param input - SKU 与数量
 * @returns 新建订单详情
 * @throws {ApiError} 标品未上架、SKU 非法、库存不足或参数无效
 */
export async function createOrderFromProduct(
  productId: number,
  userId: number,
  input: ServiceProductPurchaseInput,
): Promise<ServiceOrderDetail> {
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PRODUCT_PURCHASE_INVALID);
  }

  const product = await getProductDetailById(productId);
  if (!product || product.status !== ProductStatus.ON_SALE) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PRODUCT_NOT_ON_SALE);
  }

  const sku = product.skus.find((item) => item.id === input.skuId);
  if (!sku) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PRODUCT_SKU_NOT_FOUND);
  }

  const skuRow = await getSkuRowById(input.skuId);
  if (!skuRow || skuRow.productId !== productId) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PRODUCT_SKU_NOT_FOUND);
  }

  const decreased = await decreaseSkuStock(input.skuId, quantity);
  if (!decreased) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PRODUCT_OUT_OF_STOCK);
  }

  const unitPrice = Number(sku.price);
  const totalAmount = (unitPrice * quantity).toFixed(2);
  const feeRate = await resolvePlatformFeeRate(product.orgId);
  const platformFee = calcPlatformFee(totalAmount, feeRate);
  const orderNo = generateServiceOrderNo();

  const db = getDb();
  const [orderResult] = await db.insert(serviceOrder).values({
    orderNo,
    demandId: null,
    quoteId: null,
    productId,
    skuId: input.skuId,
    buyerUserId: userId,
    sellerOrgId: product.orgId,
    sellerProviderUserId: null,
    totalAmount,
    platformFee,
    status: ServiceOrderStatus.PENDING_PAY,
  });
  const orderId = Number(orderResult.insertId);

  const orderRows = await db.select().from(serviceOrder).where(eq(serviceOrder.id, orderId)).limit(1);
  return toOrderDetail(orderRows[0]!, null, null, product.title);
}

/**
 * 模拟支付：将待支付订单标记为已支付；发单成单时同步需求为已签约。
 *
 * @param orderId - 服务订单 ID
 * @param userId - 买方用户 ID
 * @returns 更新后的订单详情
 * @throws {ApiError} 订单不存在、无权或状态非法
 */
export async function payMockServiceOrder(orderId: number, userId: number): Promise<ServiceOrderDetail> {
  const order = await getOrderByIdForUser(orderId, userId);
  if (order.status !== ServiceOrderStatus.PENDING_PAY) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_STATUS_INVALID);
  }

  const db = getDb();
  await db
    .update(serviceOrder)
    .set({ status: ServiceOrderStatus.PAID })
    .where(eq(serviceOrder.id, orderId));

  if (order.demandId != null) {
    await db
      .update(serviceDemand)
      .set({ status: DemandStatus.CONTRACTED })
      .where(eq(serviceDemand.id, order.demandId));
  }

  const rows = await db.select().from(serviceOrder).where(eq(serviceOrder.id, orderId)).limit(1);
  return buildOrderDetail(rows[0]!);
}

/**
 * 按合法状态机推进履约订单；发单成单时同步需求状态。
 *
 * @param orderId - 服务订单 ID
 * @param userId - 操作方用户 ID（买方或卖方均可推进 M2 演示链）
 * @param input - 目标状态
 * @returns 更新后的订单详情
 * @throws {ApiError} 状态转移非法或无权
 */
export async function advanceServiceOrderStatus(
  orderId: number,
  userId: number,
  input: ServiceOrderStatusInput,
): Promise<ServiceOrderDetail> {
  const order = await getOrderByIdForUser(orderId, userId);
  const expectedNext = ORDER_STATUS_NEXT[order.status];
  if (!expectedNext || input.status !== expectedNext) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_STATUS_INVALID);
  }

  const db = getDb();
  await db.update(serviceOrder).set({ status: input.status }).where(eq(serviceOrder.id, orderId));

  if (order.demandId != null) {
    if (input.status === ServiceOrderStatus.IN_PROGRESS) {
      await db
        .update(serviceDemand)
        .set({ status: DemandStatus.IN_SERVICE })
        .where(eq(serviceDemand.id, order.demandId));
    } else if (input.status === ServiceOrderStatus.CONFIRMED) {
      await db
        .update(serviceDemand)
        .set({ status: DemandStatus.COMPLETED })
        .where(eq(serviceDemand.id, order.demandId));
    }
  }

  if (input.status === ServiceOrderStatus.CONFIRMED) {
    try {
      await applyCreditForOrderConfirmed(order.sellerProviderUserId);
    } catch (err) {
      console.error('[marketplace] applyCreditForOrderConfirmed failed', orderId, err);
    }
    try {
      await createPendingSettlementForOrder(orderId);
    } catch (err) {
      console.error('[marketplace] createPendingSettlementForOrder failed', orderId, err);
    }
  }

  const rows = await db.select().from(serviceOrder).where(eq(serviceOrder.id, orderId)).limit(1);
  return buildOrderDetail(rows[0]!);
}

/**
 * 取消待支付订单；直购单回补库存。
 *
 * @param orderId - 订单 ID
 * @param userId - 买方用户 ID
 * @returns 取消后的订单详情
 * @throws {ApiError} 非待支付、无权或不存在
 */
export async function cancelServiceOrder(
  orderId: number,
  userId: number,
): Promise<ServiceOrderDetail> {
  const order = await getOrderByIdForUser(orderId, userId);
  if (order.buyerUserId !== userId) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_FORBIDDEN);
  }
  if (order.status !== ServiceOrderStatus.PENDING_PAY) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_CANCEL_INVALID);
  }

  const db = getDb();
  await db
    .update(serviceOrder)
    .set({ status: ServiceOrderStatus.CANCELLED })
    .where(eq(serviceOrder.id, orderId));

  if (order.productId != null && order.skuId != null) {
    const unit = Number(order.totalAmount);
    const sku = await getSkuRowById(order.skuId);
    if (sku) {
      const unitPrice = Number(sku.price);
      const quantity =
        unitPrice > 0 && Number.isFinite(unit) ? Math.max(1, Math.round(unit / unitPrice)) : 1;
      await increaseSkuStock(order.skuId, quantity);
    }
  }

  const rows = await db.select().from(serviceOrder).where(eq(serviceOrder.id, orderId)).limit(1);
  return buildOrderDetail(rows[0]!);
}

/**
 * 退款占位：已支付订单可申请，返回占位状态（不调微信退款，归 E2）。
 *
 * @param orderId - 订单 ID
 * @param userId - 买方用户 ID
 * @returns 退款占位响应
 * @throws {ApiError} 无权或状态不可退
 */
export async function requestServiceOrderRefundPlaceholder(
  orderId: number,
  userId: number,
): Promise<ServiceOrderRefundPlaceholder> {
  const order = await getOrderByIdForUser(orderId, userId);
  if (order.buyerUserId !== userId) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_FORBIDDEN);
  }
  const refundable = [
    ServiceOrderStatus.PAID,
    ServiceOrderStatus.IN_PROGRESS,
    ServiceOrderStatus.DELIVERED,
  ];
  if (!refundable.includes(order.status as (typeof refundable)[number])) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_REFUND_INVALID);
  }
  return {
    orderId,
    status: 'refund_pending',
    messageKey: ApiMessageKey.MARKETPLACE_REFUND_PLACEHOLDER,
  };
}

/**
 * 发起服务订单支付：mock/auto 模式走模拟支付；微信真通道待 E2 商户号就绪。
 *
 * @param orderId - 订单 ID
 * @param userId - 买方用户 ID
 * @returns 支付后订单（mock）或抛出微信未就绪错误
 * @throws {ApiError} 状态非法、无权，或微信通道未配置
 */
export async function requestServiceOrderPay(
  orderId: number,
  userId: number,
): Promise<ServiceOrderDetail> {
  const mode = getPaymentMode();
  if (mode === 'wechat') {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PAYMENT_WECHAT_UNAVAILABLE);
  }
  return payMockServiceOrder(orderId, userId);
}

/**
 * 按 ID 读取服务订单详情（不校验归属）。
 *
 * @param orderId - 订单 ID
 * @returns 订单详情；不存在时 `null`
 */
export async function getServiceOrderById(orderId: number): Promise<ServiceOrderDetail | null> {
  const db = getDb();
  const rows = await db.select().from(serviceOrder).where(eq(serviceOrder.id, orderId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return buildOrderDetail(row);
}

/**
 * 读取服务订单并校验买方或卖方归属（含商户成员）。
 *
 * @param orderId - 订单 ID
 * @param userId - 当前用户 ID
 * @returns 订单详情
 * @throws {ApiError} 订单不存在或无权
 */
export async function getOrderByIdForUser(orderId: number, userId: number): Promise<ServiceOrderDetail> {
  const order = await getServiceOrderById(orderId);
  if (!order) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_NOT_FOUND);
  }
  const isBuyer = order.buyerUserId === userId;
  const isSeller = await isUserSellerForOrder(userId, order.sellerOrgId, order.sellerProviderUserId);
  if (!isBuyer && !isSeller) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_FORBIDDEN);
  }
  return order;
}

/**
 * 判断用户是否为指定订单的卖方（个人服务者或商户成员）。
 *
 * @param userId - 当前用户 ID
 * @param sellerOrgId - 卖方商户 ID；个人单为 `null`
 * @param sellerProviderUserId - 卖方个人用户 ID；商户单为 `null`
 * @returns 属于卖方可访问时为 true
 */
export async function isUserSellerForOrder(
  userId: number,
  sellerOrgId: number | null,
  sellerProviderUserId: number | null,
): Promise<boolean> {
  if (sellerProviderUserId === userId) {
    return true;
  }
  if (sellerOrgId != null) {
    const role = await getOrgRoleForUser(userId, sellerOrgId);
    return role != null;
  }
  return false;
}

/**
 * 列出当前用户作为卖方的服务订单（个人服务者或 active 商户成员）。
 *
 * @param userId - 当前用户 ID
 * @returns 按创建时间倒序的订单详情列表
 */
export async function listServiceOrdersBySeller(userId: number): Promise<ServiceOrderDetail[]> {
  const memberships = await listOrgMembershipsByUser(userId);
  const activeOrgIds = memberships
    .filter((item) => item.org.status === BizOrgStatus.ACTIVE)
    .map((item) => item.orgId);

  const db = getDb();
  const sellerConditions = [eq(serviceOrder.sellerProviderUserId, userId)];
  if (activeOrgIds.length > 0) {
    sellerConditions.push(inArray(serviceOrder.sellerOrgId, activeOrgIds));
  }

  const rows = await db
    .select()
    .from(serviceOrder)
    .where(or(...sellerConditions))
    .orderBy(desc(serviceOrder.createdAt));

  const result: ServiceOrderDetail[] = [];
  for (const row of rows) {
    result.push(await buildOrderDetail(row));
  }
  return result;
}

/**
 * 列出买方用户的全部服务订单。
 *
 * @param userId - 买方用户 ID
 * @returns 按创建时间倒序的订单摘要列表
 */
export async function listServiceOrdersByBuyer(userId: number): Promise<ServiceOrderSummary[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(serviceOrder)
    .where(eq(serviceOrder.buyerUserId, userId))
    .orderBy(desc(serviceOrder.createdAt));
  return rows.map(toOrderSummary);
}
