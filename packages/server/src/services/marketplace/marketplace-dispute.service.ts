import { and, count, desc, eq, like, ne, or } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  ServiceOrderDisputeStatus,
  ServiceOrderRevieweeType,
  ServiceOrderRevieweeTypeValue,
  ServiceOrderStatus,
  SERVICE_ORDER_DISPUTE_STATUSES,
  SERVICE_ORDER_DISPUTE_TYPES,
  buildPaginatedResult,
  type ServiceOrderDisputeAdminQuery,
  type ServiceOrderDisputeCreateInput,
  type ServiceOrderDisputeResolveInput,
  type ServiceOrderDisputeSummary,
} from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { serviceOrderDispute } from '../../db/schema/marketplace-dispute.js';
import { serviceOrder } from '../../db/schema/marketplace-order.js';
import { users } from '../../db/schema/users.js';
import { bizOrg } from '../../db/schema/marketplace-biz-org.js';
import { getOrderByIdForUser, isUserSellerForOrder } from './marketplace-order.service.js';
import { applyCreditForDispute } from './marketplace-credit.service.js';
import { parsePaginationQuery } from '../../utils/pagination.js';

/**
 * 将争议行映射为摘要 DTO。
 *
 * @param row - `service_order_dispute` 表行
 * @returns 争议摘要
 */
function toDisputeSummary(row: typeof serviceOrderDispute.$inferSelect): ServiceOrderDisputeSummary {
  return {
    id: row.id,
    orderId: row.orderId,
    orderNo: null,
    initiatorUserId: row.initiatorUserId,
    initiatorNickname: null,
    initiatorUsername: null,
    respondentType: row.respondentType as ServiceOrderDisputeSummary['respondentType'],
    respondentUserId: row.respondentUserId ?? null,
    respondentOrgId: row.respondentOrgId ?? null,
    respondentOrgName: null,
    type: row.type as ServiceOrderDisputeSummary['type'],
    reason: row.reason ?? null,
    status: row.status as ServiceOrderDisputeSummary['status'],
    platformNote: row.platformNote ?? null,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 补全争议摘要中的用户与组织展示名。
 *
 * @param base - 基础争议摘要
 * @returns 补全后的摘要
 */
async function enrichDisputeSummary(
  base: ServiceOrderDisputeSummary,
): Promise<ServiceOrderDisputeSummary> {
  const db = getDb();
  const [initiatorRows, orderRows, orgRows] = await Promise.all([
    db.select({ nickname: users.nickname, username: users.username }).from(users).where(eq(users.id, base.initiatorUserId)).limit(1),
    db.select({ orderNo: serviceOrder.orderNo }).from(serviceOrder).where(eq(serviceOrder.id, base.orderId)).limit(1),
    base.respondentOrgId != null
      ? db.select({ name: bizOrg.name }).from(bizOrg).where(eq(bizOrg.id, base.respondentOrgId)).limit(1)
      : Promise.resolve([]),
  ]);
  return {
    ...base,
    orderNo: orderRows[0]?.orderNo ?? null,
    initiatorNickname: initiatorRows[0]?.nickname ?? null,
    initiatorUsername: initiatorRows[0]?.username ?? null,
    respondentOrgName: orgRows[0]?.name ?? null,
  };
}

/**
 * 创建履约争议（买方发起）。
 *
 * @param orderId - 订单 ID
 * @param userId - 当前用户 ID
 * @param input - 争议类型与原因
 * @returns 新建争议摘要
 * @throws {ApiError} 订单状态非法、无权、重复未结案争议或参数无效
 */
export async function createServiceOrderDispute(
  orderId: number,
  userId: number,
  input: ServiceOrderDisputeCreateInput,
): Promise<ServiceOrderDisputeSummary> {
  if (!SERVICE_ORDER_DISPUTE_TYPES.includes(input.type)) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DISPUTE_INVALID);
  }
  const reason = input.reason?.trim();
  if (!reason || reason.length > 4000) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DISPUTE_INVALID);
  }

  const order = await getOrderByIdForUser(orderId, userId);
  if (order.buyerUserId !== userId) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DISPUTE_FORBIDDEN);
  }
  const allowedStatuses = [
    ServiceOrderStatus.PAID,
    ServiceOrderStatus.IN_PROGRESS,
    ServiceOrderStatus.DELIVERED,
    ServiceOrderStatus.CONFIRMED,
  ];
  if (!allowedStatuses.includes(order.status as (typeof allowedStatuses)[number])) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DISPUTE_FORBIDDEN);
  }

  const db = getDb();
  const unresolved = await db
    .select({ id: serviceOrderDispute.id })
    .from(serviceOrderDispute)
    .where(
      and(
        eq(serviceOrderDispute.orderId, orderId),
        ne(serviceOrderDispute.status, ServiceOrderDisputeStatus.RESOLVED_BUYER),
        ne(serviceOrderDispute.status, ServiceOrderDisputeStatus.RESOLVED_SELLER),
        ne(serviceOrderDispute.status, ServiceOrderDisputeStatus.CLOSED),
      ),
    )
    .limit(1);
  if (unresolved.length > 0) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DISPUTE_ALREADY_EXISTS);
  }

  let respondentType: ServiceOrderRevieweeTypeValue;
  let respondentUserId: number | null = null;
  let respondentOrgId: number | null = null;
  if (order.sellerOrgId != null) {
    respondentType = ServiceOrderRevieweeType.ORG;
    respondentOrgId = order.sellerOrgId;
  } else if (order.sellerProviderUserId != null) {
    respondentType = ServiceOrderRevieweeType.USER;
    respondentUserId = order.sellerProviderUserId;
  } else {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DISPUTE_FORBIDDEN);
  }

  const [insertResult] = await db.insert(serviceOrderDispute).values({
    orderId,
    initiatorUserId: userId,
    respondentType,
    respondentUserId,
    respondentOrgId,
    type: input.type,
    reason,
    status: ServiceOrderDisputeStatus.PENDING,
  });

  const disputeId = Number(insertResult.insertId);
  const rows = await db.select().from(serviceOrderDispute).where(eq(serviceOrderDispute.id, disputeId)).limit(1);
  return enrichDisputeSummary(toDisputeSummary(rows[0]!));
}

/**
 * 列出订单的全部争议（买卖双方可读）。
 *
 * @param orderId - 订单 ID
 * @param userId - 当前用户 ID
 * @returns 按创建时间倒序的争议摘要列表
 * @throws {ApiError} 订单不存在或无权
 */
export async function listServiceOrderDisputes(
  orderId: number,
  userId: number,
): Promise<ServiceOrderDisputeSummary[]> {
  await getOrderByIdForUser(orderId, userId);
  const db = getDb();
  const rows = await db
    .select()
    .from(serviceOrderDispute)
    .where(eq(serviceOrderDispute.orderId, orderId))
    .orderBy(desc(serviceOrderDispute.createdAt));
  const result: ServiceOrderDisputeSummary[] = [];
  for (const row of rows) {
    result.push(await enrichDisputeSummary(toDisputeSummary(row)));
  }
  return result;
}

/**
 * 管理端分页列出全部争议。
 *
 * @param query - 筛选与分页参数
 * @returns 分页结果
 */
export async function listServiceOrderDisputesForAdmin(query: ServiceOrderDisputeAdminQuery) {
  const db = getDb();
  const pagination = parsePaginationQuery({
    page: query.page,
    pageSize: query.pageSize,
  });
  const conditions = [];
  if (query.status) {
    conditions.push(eq(serviceOrderDispute.status, query.status));
  }
  if (query.type) {
    conditions.push(eq(serviceOrderDispute.type, query.type));
  }
  if (query.keyword) {
    const keyword = `%${query.keyword}%`;
    conditions.push(
      or(
        like(serviceOrder.orderNo, keyword),
        like(serviceOrderDispute.reason, keyword),
        like(serviceOrderDispute.platformNote, keyword),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const totalRows = await db
    .select({ count: count() })
    .from(serviceOrderDispute)
    .leftJoin(serviceOrder, eq(serviceOrderDispute.orderId, serviceOrder.id))
    .where(whereClause ?? undefined);
  const total = Number(totalRows[0]?.count ?? 0);

  const rows = await db
    .select({
      dispute: serviceOrderDispute,
      orderNo: serviceOrder.orderNo,
    })
    .from(serviceOrderDispute)
    .leftJoin(serviceOrder, eq(serviceOrderDispute.orderId, serviceOrder.id))
    .where(whereClause ?? undefined)
    .orderBy(desc(serviceOrderDispute.createdAt))
    .limit(pagination.pageSize)
    .offset((pagination.page - 1) * pagination.pageSize);

  const items: ServiceOrderDisputeSummary[] = [];
  for (const row of rows) {
    const summary = await enrichDisputeSummary(toDisputeSummary(row.dispute));
    summary.orderNo = row.orderNo ?? summary.orderNo;
    items.push(summary);
  }

  return buildPaginatedResult(items, total, pagination.page, pagination.pageSize);
}

/**
 * 平台仲裁结案争议。
 *
 * @param disputeId - 争议 ID
 * @param adminUserId - 平台运营用户 ID
 * @param input - 结案状态与备注
 * @returns 更新后的争议摘要
 * @throws {ApiError} 争议不存在、状态非法或已结案
 */
export async function resolveServiceOrderDispute(
  disputeId: number,
  adminUserId: number,
  input: ServiceOrderDisputeResolveInput,
): Promise<ServiceOrderDisputeSummary> {
  if (!SERVICE_ORDER_DISPUTE_STATUSES.includes(input.status)) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DISPUTE_STATUS_INVALID);
  }
  if (
    input.status !== ServiceOrderDisputeStatus.PLATFORM_PROCESSING &&
    input.status !== ServiceOrderDisputeStatus.RESOLVED_BUYER &&
    input.status !== ServiceOrderDisputeStatus.RESOLVED_SELLER &&
    input.status !== ServiceOrderDisputeStatus.CLOSED
  ) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DISPUTE_STATUS_INVALID);
  }

  const db = getDb();
  const rows = await db.select().from(serviceOrderDispute).where(eq(serviceOrderDispute.id, disputeId)).limit(1);
  const dispute = rows[0];
  if (!dispute) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DISPUTE_NOT_FOUND);
  }

  const terminalStatuses = [
    ServiceOrderDisputeStatus.RESOLVED_BUYER,
    ServiceOrderDisputeStatus.RESOLVED_SELLER,
    ServiceOrderDisputeStatus.CLOSED,
  ];
  if (terminalStatuses.includes(dispute.status as (typeof terminalStatuses)[number])) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DISPUTE_STATUS_INVALID);
  }

  const isTerminal =
    input.status === ServiceOrderDisputeStatus.RESOLVED_BUYER ||
    input.status === ServiceOrderDisputeStatus.RESOLVED_SELLER ||
    input.status === ServiceOrderDisputeStatus.CLOSED;
  await db
    .update(serviceOrderDispute)
    .set({
      status: input.status,
      platformNote: input.platformNote?.trim() ?? dispute.platformNote,
      resolvedAt: isTerminal ? new Date() : null,
    })
    .where(eq(serviceOrderDispute.id, disputeId));

  // 若仲裁结果对卖方不利且被申诉方为个人服务者，扣减信用分
  if (input.status === ServiceOrderDisputeStatus.RESOLVED_BUYER && dispute.respondentUserId != null) {
    try {
      await applyCreditForDispute(dispute.respondentUserId);
    } catch (err) {
      console.error('[marketplace] applyCreditForDispute failed', disputeId, err);
    }
  }

  const updated = await db.select().from(serviceOrderDispute).where(eq(serviceOrderDispute.id, disputeId)).limit(1);
  return enrichDisputeSummary(toDisputeSummary(updated[0]!));
}
