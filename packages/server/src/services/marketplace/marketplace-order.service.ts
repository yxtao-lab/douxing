import { and, desc, eq, inArray, ne, or } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  BizOrgStatus,
  DemandStatus,
  QuoteStatus,
  ServiceOrderStatus,
  type DemandSelectQuoteInput,
  type ServiceOrderDetail,
  type ServiceOrderStatusInput,
  type ServiceOrderSummary,
} from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { demandQuote, serviceDemand } from '../../db/schema/marketplace-demand.js';
import { serviceOrder } from '../../db/schema/marketplace-order.js';
import { getDemandById, getDemandByIdForUser } from './marketplace-demand.service.js';
import { generateServiceOrderNo } from './marketplace-org.service.js';
import { getOrgRoleForUser, listOrgMembershipsByUser } from './marketplace-org-onboard.service.js';
import { getQuoteRowById } from './marketplace-quote.service.js';

const DEFAULT_PLATFORM_FEE_RATE = 0.05;

/** 订单状态合法后继映射 */
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
    demandId: row.demandId,
    quoteId: row.quoteId,
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
 * @param demandTitle - 关联需求标题
 * @param demandNo - 关联需求单号
 * @returns 订单详情
 */
function toOrderDetail(
  row: typeof serviceOrder.$inferSelect,
  demandTitle: string | null,
  demandNo: string | null,
): ServiceOrderDetail {
  return {
    ...toOrderSummary(row),
    demandTitle,
    demandNo,
  };
}

/**
 * 计算平台抽佣金额。
 *
 * @param totalAmount - 订单总金额字符串
 * @param rate - 抽佣比例，默认 5%
 * @returns 抽佣金额字符串（两位小数）
 */
function calcPlatformFee(totalAmount: string, rate = DEFAULT_PLATFORM_FEE_RATE): string {
  const total = Number(totalAmount);
  if (!Number.isFinite(total) || total <= 0) return '0.00';
  return (total * rate).toFixed(2);
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
  const platformFee = calcPlatformFee(totalAmount);

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
  return toOrderDetail(orderRow, demand.title, demand.demandNo);
}

/**
 * 模拟支付：将待支付订单标记为已支付，并推进需求单为已签约。
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

  await db
    .update(serviceDemand)
    .set({ status: DemandStatus.CONTRACTED })
    .where(eq(serviceDemand.id, order.demandId));

  const rows = await db.select().from(serviceOrder).where(eq(serviceOrder.id, orderId)).limit(1);
  const row = rows[0]!;
  const demand = await getDemandById(order.demandId);
  return toOrderDetail(row, demand?.title ?? null, demand?.demandNo ?? null);
}

/**
 * 按合法状态机推进履约订单，并同步需求单状态。
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

  const rows = await db.select().from(serviceOrder).where(eq(serviceOrder.id, orderId)).limit(1);
  const row = rows[0]!;
  const demand = await getDemandById(order.demandId);
  return toOrderDetail(row, demand?.title ?? null, demand?.demandNo ?? null);
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
  const demand = await getDemandById(row.demandId);
  return toOrderDetail(row, demand?.title ?? null, demand?.demandNo ?? null);
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
    const demand = await getDemandById(row.demandId);
    result.push(toOrderDetail(row, demand?.title ?? null, demand?.demandNo ?? null));
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
