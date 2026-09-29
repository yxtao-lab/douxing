import { and, count, desc, eq, inArray } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  RouteReportReason,
  RouteReportStatus,
  RouteVerificationStatus,
  UGC_RATE_LIMITS,
  buildPaginatedResult,
  isRouteReportReason,
  type CreateRouteReportRequest,
  type PaginatedResult,
  type RouteReportInfo,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { routeReports } from '../db/schema/route-reports.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { users } from '../db/schema/users.js';
import { formatDbDateTimeForApi } from '../utils/api-datetime.js';
import { assertUgcRateLimit } from './ugc-rate-limit.service.js';
import { awardCorrectionAccepted } from './verification-points.service.js';

/**
 * 安全触发可信度重算（避免与 route-trust 循环依赖）。
 *
 * @param routeId - 路线 ID
 */
async function recomputeTrustAfterReport(routeId: number): Promise<void> {
  const { recomputeRouteTrustSafe } = await import('./route-trust.service.js');
  await recomputeRouteTrustSafe(routeId);
}
function toReportInfo(row: {
  id: number;
  routeId: number;
  routeName?: string | null;
  reporterUserId: number;
  reporterNickname?: string | null;
  reason: string;
  detail: string | null;
  status: string;
  resolverUserId: number | null;
  resolveNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}): RouteReportInfo {
  return {
    id: Number(row.id),
    routeId: row.routeId,
    routeName: row.routeName ?? null,
    reporterUserId: row.reporterUserId,
    reporterNickname: row.reporterNickname ?? null,
    reason: row.reason,
    detail: row.detail,
    status: row.status,
    resolverUserId: row.resolverUserId,
    resolveNote: row.resolveNote,
    resolvedAt: row.resolvedAt ? formatDbDateTimeForApi(row.resolvedAt) : null,
    createdAt: formatDbDateTimeForApi(row.createdAt),
  };
}

/**
 * 统计路线未结案报错数。
 *
 * @param routeId - 路线 ID
 * @returns 未结案条数
 */
export async function countOpenRouteReports(routeId: number): Promise<number> {
  const db = getDb();
  const [{ value }] = await db
    .select({ value: count() })
    .from(routeReports)
    .where(
      and(eq(routeReports.routeId, routeId), eq(routeReports.status, RouteReportStatus.OPEN)),
    );
  return Number(value ?? 0);
}

/**
 * 用户提交路线报错（频控 + 同因去重）。
 *
 * @param routeId - 路线
 * @param userId - 举报人
 * @param input - 原因与说明
 * @returns 新建工单
 * @throws {ApiError} 原因非法、自举报、重复、频控、路线不存在
 */
export async function createRouteReport(
  routeId: number,
  userId: number,
  input: CreateRouteReportRequest,
): Promise<RouteReportInfo> {
  const reason = input.reason?.trim() ?? '';
  if (!isRouteReportReason(reason)) {
    throw new ApiError(ApiMessageKey.ROUTE_REPORT_REASON_INVALID);
  }

  await assertUgcRateLimit(
    userId,
    'report',
    UGC_RATE_LIMITS.REPORT_PER_DAY,
    UGC_RATE_LIMITS.REPORT_WINDOW_SEC,
  );

  const db = getDb();
  const routes = await db.select().from(travelRoutes).where(eq(travelRoutes.id, routeId)).limit(1);
  const route = routes[0];
  if (!route || route.isPublic !== 1) {
    throw new ApiError(ApiMessageKey.ROUTE_NOT_FOUND);
  }
  if (route.creatorId === userId) {
    throw new ApiError(ApiMessageKey.ROUTE_REPORT_SELF_FORBIDDEN);
  }

  const existing = await db
    .select({ id: routeReports.id })
    .from(routeReports)
    .where(
      and(
        eq(routeReports.routeId, routeId),
        eq(routeReports.reporterUserId, userId),
        eq(routeReports.reason, reason),
      ),
    )
    .limit(1);
  if (existing[0]) {
    throw new ApiError(ApiMessageKey.ROUTE_REPORT_DUPLICATE);
  }

  try {
    const [inserted] = await db.insert(routeReports).values({
      routeId,
      reporterUserId: userId,
      reason,
      detail: input.detail?.trim().slice(0, 1000) || null,
      status: RouteReportStatus.OPEN,
    });
    const id = Number(inserted.insertId);
    await recomputeTrustAfterReport(routeId);

    const rows = await db
      .select({
        id: routeReports.id,
        routeId: routeReports.routeId,
        routeName: travelRoutes.name,
        reporterUserId: routeReports.reporterUserId,
        reporterNickname: users.nickname,
        reason: routeReports.reason,
        detail: routeReports.detail,
        status: routeReports.status,
        resolverUserId: routeReports.resolverUserId,
        resolveNote: routeReports.resolveNote,
        resolvedAt: routeReports.resolvedAt,
        createdAt: routeReports.createdAt,
      })
      .from(routeReports)
      .innerJoin(travelRoutes, eq(routeReports.routeId, travelRoutes.id))
      .innerJoin(users, eq(routeReports.reporterUserId, users.id))
      .where(eq(routeReports.id, id))
      .limit(1);
    return toReportInfo(rows[0]!);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('uk_route_reports_reporter_reason') || message.includes('Duplicate')) {
      throw new ApiError(ApiMessageKey.ROUTE_REPORT_DUPLICATE);
    }
    throw err;
  }
}

/**
 * 管理端分页列出报错工单。
 *
 * @param options.status - 状态过滤；默认 open
 * @param options.page - 页码
 * @param options.pageSize - 每页
 * @returns 分页结果
 */
export async function listRouteReports(options: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<RouteReportInfo>> {
  const status = options.status?.trim() || RouteReportStatus.OPEN;
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(options.pageSize ?? 20)));
  const db = getDb();
  const where = eq(routeReports.status, status);

  const [{ value: total }] = await db.select({ value: count() }).from(routeReports).where(where);
  const rows = await db
    .select({
      id: routeReports.id,
      routeId: routeReports.routeId,
      routeName: travelRoutes.name,
      reporterUserId: routeReports.reporterUserId,
      reporterNickname: users.nickname,
      reason: routeReports.reason,
      detail: routeReports.detail,
      status: routeReports.status,
      resolverUserId: routeReports.resolverUserId,
      resolveNote: routeReports.resolveNote,
      resolvedAt: routeReports.resolvedAt,
      createdAt: routeReports.createdAt,
    })
    .from(routeReports)
    .innerJoin(travelRoutes, eq(routeReports.routeId, travelRoutes.id))
    .innerJoin(users, eq(routeReports.reporterUserId, users.id))
    .where(where)
    .orderBy(desc(routeReports.createdAt), desc(routeReports.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return buildPaginatedResult(rows.map(toReportInfo), Number(total), page, pageSize);
}

/**
 * 运营采纳报错：给举报人验证积分；过期类报错会将路线标回待核验。
 *
 * @param reportId - 工单 ID
 * @param resolverUserId - 处理人
 * @param resolveNote - 备注
 * @returns 更新后的工单
 * @throws {ApiError} 不存在或非 open
 */
export async function acceptRouteReport(
  reportId: number,
  resolverUserId: number,
  resolveNote?: string | null,
): Promise<RouteReportInfo> {
  const db = getDb();
  const rows = await db.select().from(routeReports).where(eq(routeReports.id, reportId)).limit(1);
  const report = rows[0];
  if (!report) throw new ApiError(ApiMessageKey.ROUTE_REPORT_NOT_FOUND);
  if (report.status !== RouteReportStatus.OPEN) {
    throw new ApiError(ApiMessageKey.ROUTE_REPORT_NOT_OPEN);
  }

  await db
    .update(routeReports)
    .set({
      status: RouteReportStatus.ACCEPTED,
      resolverUserId,
      resolveNote: resolveNote?.trim().slice(0, 512) || null,
      resolvedAt: new Date(),
    })
    .where(eq(routeReports.id, reportId));

  if (report.reason === RouteReportReason.OUTDATED) {
    await db
      .update(travelRoutes)
      .set({ verificationStatus: RouteVerificationStatus.PENDING })
      .where(eq(travelRoutes.id, report.routeId));
  }

  await awardCorrectionAccepted(
    report.reporterUserId,
    report.routeId,
    `report:${reportId}`,
  );
  await recomputeTrustAfterReport(report.routeId);

  const refreshed = await listRouteReportsByIds([reportId]);
  return refreshed[0]!;
}

/**
 * 运营驳回报错。
 *
 * @param reportId - 工单 ID
 * @param resolverUserId - 处理人
 * @param resolveNote - 备注
 * @returns 更新后的工单
 */
export async function rejectRouteReport(
  reportId: number,
  resolverUserId: number,
  resolveNote?: string | null,
): Promise<RouteReportInfo> {
  const db = getDb();
  const rows = await db.select().from(routeReports).where(eq(routeReports.id, reportId)).limit(1);
  const report = rows[0];
  if (!report) throw new ApiError(ApiMessageKey.ROUTE_REPORT_NOT_FOUND);
  if (report.status !== RouteReportStatus.OPEN) {
    throw new ApiError(ApiMessageKey.ROUTE_REPORT_NOT_OPEN);
  }

  await db
    .update(routeReports)
    .set({
      status: RouteReportStatus.REJECTED,
      resolverUserId,
      resolveNote: resolveNote?.trim().slice(0, 512) || null,
      resolvedAt: new Date(),
    })
    .where(eq(routeReports.id, reportId));

  await recomputeTrustAfterReport(report.routeId);
  const refreshed = await listRouteReportsByIds([reportId]);
  return refreshed[0]!;
}

/**
 * 按 ID 批量读取报错详情。
 *
 * @param ids - 工单 ID 列表
 * @returns 详情列表
 */
async function listRouteReportsByIds(ids: number[]): Promise<RouteReportInfo[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: routeReports.id,
      routeId: routeReports.routeId,
      routeName: travelRoutes.name,
      reporterUserId: routeReports.reporterUserId,
      reporterNickname: users.nickname,
      reason: routeReports.reason,
      detail: routeReports.detail,
      status: routeReports.status,
      resolverUserId: routeReports.resolverUserId,
      resolveNote: routeReports.resolveNote,
      resolvedAt: routeReports.resolvedAt,
      createdAt: routeReports.createdAt,
    })
    .from(routeReports)
    .innerJoin(travelRoutes, eq(routeReports.routeId, travelRoutes.id))
    .innerJoin(users, eq(routeReports.reporterUserId, users.id))
    .where(inArray(routeReports.id, ids));
  return rows.map(toReportInfo);
}
