import { and, count, desc, eq, like, or } from 'drizzle-orm';
import {
  ApiMessageKey,
  DemandStatus,
  PublisherType,
  isValidServiceCategoryCode,
  type PaginatedResult,
  type ServiceDemandDetail,
  type ServiceDemandHallQuery,
  type ServiceDemandInput,
  type ServiceDemandSummary,
} from '@douxing/shared';
import { ApiError } from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { serviceDemand } from '../../db/schema/marketplace-demand.js';
import { travelRoutes } from '../../db/schema/travel-routes.js';
import { generateDemandNo } from './marketplace-org.service.js';

const HALL_STATUSES = [DemandStatus.PUBLISHED, DemandStatus.QUOTING] as const;

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
 * 校验需求单创建/更新入参。
 *
 * @param input - 需求表单
 * @throws {ApiError} 参数无效时抛出
 */
function validateDemandInput(input: ServiceDemandInput): void {
  const title = input.title?.trim();
  if (!title || title.length < 2 || title.length > 200) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DEMAND_INVALID);
  }
  if (!isValidServiceCategoryCode(input.categoryCode)) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_CATEGORY_INVALID);
  }
  if (input.routeId != null) {
    const routeId = Number(input.routeId);
    if (!Number.isInteger(routeId) || routeId <= 0) {
      throw new ApiError(ApiMessageKey.MARKETPLACE_DEMAND_INVALID);
    }
  }
}

/**
 * 校验可选关联路线归属当前用户。
 *
 * @param userId - 发单方用户 ID
 * @param routeId - 路线 ID；为空时跳过
 * @throws {ApiError} 路线不存在或不属于用户
 */
async function assertRouteOwnedByUser(userId: number, routeId?: number): Promise<void> {
  if (routeId == null) return;
  const db = getDb();
  const rows = await db
    .select({ id: travelRoutes.id })
    .from(travelRoutes)
    .where(and(eq(travelRoutes.id, routeId), eq(travelRoutes.creatorId, userId)))
    .limit(1);
  if (!rows[0]) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DEMAND_INVALID);
  }
}

/**
 * 构建需求单写入字段。
 *
 * @param input - 需求表单
 * @returns Drizzle insert/update 可用字段
 */
function buildDemandValues(input: ServiceDemandInput) {
  return {
    categoryCode: input.categoryCode,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    destination: input.destination?.trim() || null,
    startDate: input.startDate || null,
    endDate: input.endDate || null,
    budgetMin: input.budgetMin ?? null,
    budgetMax: input.budgetMax ?? null,
    budgetType: input.budgetType ?? null,
    routeId: input.routeId ?? null,
  };
}

/**
 * 创建个人发单草稿。
 *
 * @param userId - 发单方用户 ID
 * @param input - 需求表单
 * @returns 新建需求单详情
 * @throws {ApiError} 参数无效或路线归属不符
 */
export async function createDemand(userId: number, input: ServiceDemandInput): Promise<ServiceDemandDetail> {
  validateDemandInput(input);
  await assertRouteOwnedByUser(userId, input.routeId);

  const db = getDb();
  const [result] = await db.insert(serviceDemand).values({
    demandNo: generateDemandNo(),
    publisherType: PublisherType.USER,
    publisherUserId: userId,
    status: DemandStatus.DRAFT,
    ...buildDemandValues(input),
  });
  const id = Number(result.insertId);
  const rows = await db.select().from(serviceDemand).where(eq(serviceDemand.id, id)).limit(1);
  return toDemandDetail(rows[0]!);
}

/**
 * 更新草稿需求单（仅 `draft` 状态可改）。
 *
 * @param id - 需求单 ID
 * @param userId - 发单方用户 ID
 * @param input - 更新字段
 * @returns 更新后的需求单详情
 * @throws {ApiError} 非草稿、无权或参数无效
 */
export async function updateDemand(
  id: number,
  userId: number,
  input: ServiceDemandInput,
): Promise<ServiceDemandDetail> {
  const existing = await getDemandByIdForUser(id, userId);
  if (existing.status !== DemandStatus.DRAFT) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DEMAND_STATUS_INVALID);
  }

  validateDemandInput(input);
  await assertRouteOwnedByUser(userId, input.routeId);

  const db = getDb();
  await db.update(serviceDemand).set(buildDemandValues(input)).where(eq(serviceDemand.id, id));
  const rows = await db.select().from(serviceDemand).where(eq(serviceDemand.id, id)).limit(1);
  return toDemandDetail(rows[0]!);
}

/**
 * 将草稿需求单发布到需求大厅。
 *
 * @param id - 需求单 ID
 * @param userId - 发单方用户 ID
 * @returns 发布后的需求单详情
 * @throws {ApiError} 非草稿或无权
 */
export async function publishDemand(id: number, userId: number): Promise<ServiceDemandDetail> {
  const existing = await getDemandByIdForUser(id, userId);
  if (existing.status !== DemandStatus.DRAFT) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DEMAND_NOT_PUBLISHABLE);
  }

  const db = getDb();
  await db
    .update(serviceDemand)
    .set({ status: DemandStatus.PUBLISHED })
    .where(eq(serviceDemand.id, id));

  const rows = await db.select().from(serviceDemand).where(eq(serviceDemand.id, id)).limit(1);
  return toDemandDetail(rows[0]!);
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
 * 需求大厅：列出已发布/报价中的需求单。
 *
 * @param query - 筛选与分页参数
 * @returns 分页结果
 */
export async function listPublishedDemands(
  query: ServiceDemandHallQuery,
): Promise<PaginatedResult<ServiceDemandSummary>> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const db = getDb();
  const conditions = [
    or(
      eq(serviceDemand.status, DemandStatus.PUBLISHED),
      eq(serviceDemand.status, DemandStatus.QUOTING),
    ),
  ];

  if (query.categoryCode) {
    conditions.push(eq(serviceDemand.categoryCode, query.categoryCode));
  }
  if (query.destination?.trim()) {
    conditions.push(like(serviceDemand.destination, `%${query.destination.trim()}%`));
  }
  if (query.keyword?.trim()) {
    const kw = `%${query.keyword.trim()}%`;
    conditions.push(or(like(serviceDemand.title, kw), like(serviceDemand.destination, kw)));
  }

  const whereClause = and(...conditions);

  const [countRow] = await db.select({ total: count() }).from(serviceDemand).where(whereClause);
  const total = Number(countRow?.total ?? 0);

  const rows = await db
    .select()
    .from(serviceDemand)
    .where(whereClause)
    .orderBy(desc(serviceDemand.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    items: rows.map(toDemandSummary),
    total,
    page,
    pageSize,
  };
}

/**
 * 管理端分页列出全部需求单。
 *
 * @param params - 筛选与分页
 * @returns 分页结果
 */
export async function listDemandsForAdminPage(params: {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  categoryCode?: string;
  destination?: string;
}): Promise<PaginatedResult<ServiceDemandSummary>> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const offset = (page - 1) * pageSize;
  const db = getDb();

  const conditions = [];
  if (params.status) {
    conditions.push(eq(serviceDemand.status, params.status));
  }
  if (params.categoryCode) {
    conditions.push(eq(serviceDemand.categoryCode, params.categoryCode));
  }
  if (params.destination?.trim()) {
    conditions.push(like(serviceDemand.destination, `%${params.destination.trim()}%`));
  }
  if (params.keyword?.trim()) {
    const kw = `%${params.keyword.trim()}%`;
    conditions.push(
      or(
        like(serviceDemand.title, kw),
        like(serviceDemand.demandNo, kw),
        like(serviceDemand.destination, kw),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ total: count() })
    .from(serviceDemand)
    .where(whereClause);
  const total = Number(countRow?.total ?? 0);

  const rows = await db
    .select()
    .from(serviceDemand)
    .where(whereClause)
    .orderBy(desc(serviceDemand.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items: rows.map(toDemandSummary), total, page, pageSize };
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

/**
 * 读取需求单详情：发单方本人或大厅公开状态均可查看。
 *
 * @param id - 需求单主键
 * @param userId - 当前登录用户 ID
 * @returns 需求单详情
 * @throws {ApiError} 不存在或无权查看非公开需求
 */
export async function getDemandByIdForViewer(
  id: number,
  userId: number,
): Promise<ServiceDemandDetail> {
  const demand = await getDemandById(id);
  if (!demand) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DEMAND_NOT_FOUND);
  }
  if (demand.publisherUserId === userId) {
    return demand;
  }
  if ((HALL_STATUSES as readonly string[]).includes(demand.status)) {
    return demand;
  }
  throw new ApiError(ApiMessageKey.MARKETPLACE_DEMAND_FORBIDDEN);
}
