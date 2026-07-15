import { asc, eq } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  ServiceOrderReportType,
  ServiceOrderStatus,
  type ServiceOrderReportCreateInput,
  type ServiceOrderReportSummary,
} from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { serviceOrderReport } from '../../db/schema/marketplace-order-report.js';
import { users } from '../../db/schema/users.js';
import {
  getOrderByIdForUser,
  isUserSellerForOrder,
} from './marketplace-order.service.js';

const REPORTABLE_STATUSES = new Set<string>([
  ServiceOrderStatus.IN_PROGRESS,
  ServiceOrderStatus.DELIVERED,
]);

/**
 * 将汇报表行映射为摘要 DTO。
 *
 * @param row - `service_order_report` 行
 * @param author - 作者展示名
 * @returns 汇报摘要
 */
function toReportSummary(
  row: typeof serviceOrderReport.$inferSelect,
  author?: { nickname: string | null; username: string | null },
): ServiceOrderReportSummary {
  const photos = Array.isArray(row.photos) ? row.photos.filter((p) => typeof p === 'string') : [];
  return {
    id: row.id,
    orderId: row.orderId,
    authorUserId: row.authorUserId,
    authorNickname: author?.nickname ?? null,
    authorUsername: author?.username ?? null,
    reportType: row.reportType as ServiceOrderReportSummary['reportType'],
    content: row.content ?? null,
    photos,
    latitude: row.latitude != null ? String(row.latitude) : null,
    longitude: row.longitude != null ? String(row.longitude) : null,
    placeName: row.placeName ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 校验当前用户是否可读写该订单的履约汇报（买方可读；卖方侧可读写）。
 *
 * @param orderId - 订单 ID
 * @param userId - 当前用户
 * @param requireSellerWrite - 为 true 时须为卖方侧（含指派领队）
 * @returns 订单详情
 * @throws {ApiError} 无权或不存在
 */
async function assertReportAccess(orderId: number, userId: number, requireSellerWrite: boolean) {
  const order = await getOrderByIdForUser(orderId, userId);
  if (!requireSellerWrite) {
    return order;
  }
  const isSeller = await isUserSellerForOrder(
    userId,
    order.sellerOrgId,
    order.sellerProviderUserId,
    order.assignedGuideUserId,
  );
  if (!isSeller) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_REPORT_FORBIDDEN);
  }
  return order;
}

/**
 * 列出订单履约汇报时间线（买方或卖方侧可读）。
 *
 * @param orderId - 订单 ID
 * @param userId - 当前用户 ID
 * @returns 按创建时间升序；无记录为空数组
 * @throws {ApiError} 无权查看订单
 */
export async function listServiceOrderReports(
  orderId: number,
  userId: number,
): Promise<ServiceOrderReportSummary[]> {
  await assertReportAccess(orderId, userId, false);

  const db = getDb();
  const rows = await db
    .select({
      report: serviceOrderReport,
      nickname: users.nickname,
      username: users.username,
    })
    .from(serviceOrderReport)
    .leftJoin(users, eq(users.id, serviceOrderReport.authorUserId))
    .where(eq(serviceOrderReport.orderId, orderId))
    .orderBy(asc(serviceOrderReport.createdAt));

  return rows.map((item) =>
    toReportSummary(item.report, {
      nickname: item.nickname,
      username: item.username,
    }),
  );
}

/**
 * 创建履约汇报（签到或图文）；仅卖方侧，且订单为进行中/已交付。
 *
 * @param orderId - 订单 ID
 * @param userId - 作者用户 ID
 * @param input - 汇报表单
 * @returns 新建汇报摘要
 * @throws {ApiError} 状态非法、无权或内容无效
 */
export async function createServiceOrderReport(
  orderId: number,
  userId: number,
  input: ServiceOrderReportCreateInput,
): Promise<ServiceOrderReportSummary> {
  const order = await assertReportAccess(orderId, userId, true);

  if (!REPORTABLE_STATUSES.has(order.status)) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_REPORT_STATUS_INVALID);
  }

  if (
    input.reportType !== ServiceOrderReportType.CHECKIN &&
    input.reportType !== ServiceOrderReportType.REPORT
  ) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_REPORT_INVALID);
  }

  const content = input.content?.trim() || null;
  const photos = (input.photos ?? []).filter((p) => typeof p === 'string' && p.trim().length > 0);
  const placeName = input.placeName?.trim() || null;

  if (input.reportType === ServiceOrderReportType.CHECKIN) {
    const hasLocation =
      (input.latitude != null && input.longitude != null) || Boolean(placeName);
    if (!hasLocation && !content && photos.length === 0) {
      throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_REPORT_INVALID);
    }
  } else if (!content && photos.length === 0) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_REPORT_INVALID);
  }

  if (photos.length > 9) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_REPORT_INVALID);
  }

  let latitude: string | null = null;
  let longitude: string | null = null;
  if (input.latitude != null || input.longitude != null) {
    if (
      input.latitude == null ||
      input.longitude == null ||
      !Number.isFinite(input.latitude) ||
      !Number.isFinite(input.longitude) ||
      input.latitude < -90 ||
      input.latitude > 90 ||
      input.longitude < -180 ||
      input.longitude > 180
    ) {
      throw new ApiError(ApiMessageKey.MARKETPLACE_ORDER_REPORT_INVALID);
    }
    latitude = input.latitude.toFixed(7);
    longitude = input.longitude.toFixed(7);
  }

  const db = getDb();
  const [result] = await db.insert(serviceOrderReport).values({
    orderId,
    authorUserId: userId,
    reportType: input.reportType,
    content,
    photos: photos.length > 0 ? photos : null,
    latitude,
    longitude,
    placeName,
  });
  const reportId = Number(result.insertId);

  const rows = await db
    .select({
      report: serviceOrderReport,
      nickname: users.nickname,
      username: users.username,
    })
    .from(serviceOrderReport)
    .leftJoin(users, eq(users.id, serviceOrderReport.authorUserId))
    .where(eq(serviceOrderReport.id, reportId))
    .limit(1);

  const item = rows[0];
  if (!item) {
    throw new ApiError(ApiMessageKey.SERVER_ERROR);
  }
  return toReportSummary(item.report, {
    nickname: item.nickname,
    username: item.username,
  });
}
