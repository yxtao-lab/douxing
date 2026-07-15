import {
  ApiError,
  ApiMessageKey,
  SettlementStatus,
  type OrgSettlementSummary,
} from '@douxing/shared';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { orgSettlement } from '../../db/schema/marketplace-settlement.js';
import { serviceOrder } from '../../db/schema/marketplace-order.js';

/**
 * 将结算行映射为 API 摘要。
 *
 * @param row - `org_settlement` 行
 * @returns 结算摘要
 */
function toSettlementSummary(row: typeof orgSettlement.$inferSelect): OrgSettlementSummary {
  return {
    id: row.id,
    orgId: row.orgId,
    orderId: row.orderId,
    orderNo: row.orderNo,
    grossAmount: String(row.grossAmount),
    platformFee: String(row.platformFee),
    netAmount: String(row.netAmount),
    status: row.status as OrgSettlementSummary['status'],
    createdAt: row.createdAt.toISOString(),
    settledAt: row.settledAt ? row.settledAt.toISOString() : null,
  };
}

/**
 * 订单履约确认后为卖方商户生成待结算台账（幂等；无 sellerOrgId 则跳过）。
 *
 * @param orderId - 服务订单 ID
 * @returns 新建或已存在的结算摘要；跳过时为 `null`
 * @throws {ApiError} 订单不存在
 */
export async function createPendingSettlementForOrder(
  orderId: number,
): Promise<OrgSettlementSummary | null> {
  const db = getDb();
  const orderRows = await db.select().from(serviceOrder).where(eq(serviceOrder.id, orderId)).limit(1);
  const order = orderRows[0];
  if (!order) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_NOT_FOUND);
  }
  if (order.sellerOrgId == null) {
    return null;
  }

  const existing = await db
    .select()
    .from(orgSettlement)
    .where(eq(orgSettlement.orderId, orderId))
    .limit(1);
  if (existing[0]) {
    return toSettlementSummary(existing[0]);
  }

  const gross = Number(order.totalAmount);
  const fee = Number(order.platformFee);
  const net = Math.max(0, gross - fee).toFixed(2);

  const [result] = await db.insert(orgSettlement).values({
    orgId: order.sellerOrgId,
    orderId: order.id,
    orderNo: order.orderNo,
    grossAmount: String(order.totalAmount),
    platformFee: String(order.platformFee),
    netAmount: net,
    status: SettlementStatus.PENDING,
  });

  const rows = await db
    .select()
    .from(orgSettlement)
    .where(eq(orgSettlement.id, Number(result.insertId)))
    .limit(1);
  return toSettlementSummary(rows[0]!);
}

/**
 * 按商户列出结算台账。
 *
 * @param orgId - 商户 ID
 * @param status - 可选状态过滤
 * @returns 按创建时间倒序；无记录为空数组
 */
export async function listSettlementsByOrg(
  orgId: number,
  status?: string,
): Promise<OrgSettlementSummary[]> {
  const db = getDb();
  const conditions = [eq(orgSettlement.orgId, orgId)];
  if (status) {
    conditions.push(eq(orgSettlement.status, status));
  }
  const rows = await db
    .select()
    .from(orgSettlement)
    .where(and(...conditions))
    .orderBy(desc(orgSettlement.createdAt));
  return rows.map(toSettlementSummary);
}

/**
 * 管理端列出全部待结算/已结算台账（可按商户过滤）。
 *
 * @param options - `orgId` / `status` 可选筛选
 * @returns 按创建时间倒序
 */
export async function listSettlementsForAdmin(options?: {
  orgId?: number;
  status?: string;
}): Promise<OrgSettlementSummary[]> {
  const db = getDb();
  const conditions = [];
  if (options?.orgId != null) {
    conditions.push(eq(orgSettlement.orgId, options.orgId));
  }
  if (options?.status) {
    conditions.push(eq(orgSettlement.status, options.status));
  }
  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(orgSettlement)
          .where(and(...conditions))
          .orderBy(desc(orgSettlement.createdAt))
      : await db.select().from(orgSettlement).orderBy(desc(orgSettlement.createdAt));
  return rows.map(toSettlementSummary);
}

/**
 * 按订单 ID 读取结算台账。
 *
 * @param orderId - 订单 ID
 * @returns 结算摘要；不存在为 `null`
 */
export async function getSettlementByOrderId(orderId: number): Promise<OrgSettlementSummary | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(orgSettlement)
    .where(eq(orgSettlement.orderId, orderId))
    .limit(1);
  return rows[0] ? toSettlementSummary(rows[0]) : null;
}
