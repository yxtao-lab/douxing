import { desc, eq } from 'drizzle-orm';
import {
  ApiMessageKey,
  type ServiceDemandDetail,
  type ServiceDemandSummary,
} from '@douxing/shared';
import { ApiError } from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { serviceDemand } from '../../db/schema/marketplace-demand.js';

/**
 * 将需求单行映射为列表摘要 DTO。
 *
 * @param row - `service_demand` 表行
 * @returns 需求单摘要
 */
function toDemandSummary(row: typeof serviceDemand.$inferSelect): ServiceDemandSummary {
  return {
    id: row.id,
    demandNo: row.demandNo,
    publisherType: row.publisherType as ServiceDemandSummary['publisherType'],
    publisherUserId: row.publisherUserId,
    categoryCode: row.categoryCode,
    title: row.title,
    destination: row.destination,
    startDate: row.startDate ? String(row.startDate) : null,
    endDate: row.endDate ? String(row.endDate) : null,
    budgetMin: row.budgetMin != null ? String(row.budgetMin) : null,
    budgetMax: row.budgetMax != null ? String(row.budgetMax) : null,
    budgetType: row.budgetType as ServiceDemandSummary['budgetType'],
    status: row.status as ServiceDemandSummary['status'],
    routeId: row.routeId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 将需求单行映射为详情 DTO。
 *
 * @param row - `service_demand` 表行
 * @returns 需求单详情
 */
function toDemandDetail(row: typeof serviceDemand.$inferSelect): ServiceDemandDetail {
  return {
    ...toDemandSummary(row),
    description: row.description,
    publisherGroupId: row.publisherGroupId,
  };
}

/**
 * 列出指定用户作为发单方创建的需求单。
 *
 * @param userId - 发单方用户 ID
 * @returns 按创建时间倒序的需求单摘要列表；无记录时为空数组
 */
export async function listDemandsByUser(userId: number): Promise<ServiceDemandSummary[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(serviceDemand)
    .where(eq(serviceDemand.publisherUserId, userId))
    .orderBy(desc(serviceDemand.createdAt));
  return rows.map(toDemandSummary);
}

/**
 * 按 ID 读取需求单详情（不校验归属，仅供内部或管理端）。
 *
 * @param id - 需求单主键
 * @returns 详情；不存在时 `null`
 */
export async function getDemandById(id: number): Promise<ServiceDemandDetail | null> {
  const db = getDb();
  const rows = await db.select().from(serviceDemand).where(eq(serviceDemand.id, id)).limit(1);
  const row = rows[0];
  return row ? toDemandDetail(row) : null;
}

/**
 * 读取需求单详情并校验发单方归属。
 *
 * @param id - 需求单主键
 * @param userId - 当前登录用户 ID
 * @returns 需求单详情
 * @throws {ApiError} `MARKETPLACE_DEMAND_NOT_FOUND` 记录不存在
 * @throws {ApiError} `MARKETPLACE_DEMAND_FORBIDDEN` 非发单方本人
 */
export async function getDemandByIdForUser(
  id: number,
  userId: number,
): Promise<ServiceDemandDetail> {
  const demand = await getDemandById(id);
  if (!demand) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DEMAND_NOT_FOUND);
  }
  if (demand.publisherUserId !== userId) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DEMAND_FORBIDDEN);
  }
  return demand;
}
