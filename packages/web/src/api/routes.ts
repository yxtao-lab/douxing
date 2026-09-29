import http from './http';
import {
  normalizePaginatedResult,
  type ApiResponse,
  type PaginatedResult,
  type RouteCommentInfo,
  type RouteModerationActionValue,
  type RouteReportInfo,
  type RouteSpotCheckItem,
  type TravelRouteInfo,
} from '@douxing/shared';

export interface AdminRouteListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: number;
  creatorId?: number;
  dateStart?: string;
  dateEnd?: string;
}

export async function fetchRoutesPage(params: AdminRouteListParams) {
  const query = new URLSearchParams({
    all: '1',
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.status != null) query.set('status', String(params.status));
  if (params.creatorId != null) query.set('creatorId', String(params.creatorId));
  if (params.dateStart) query.set('dateStart', params.dateStart);
  if (params.dateEnd) query.set('dateEnd', params.dateEnd);
  const { data } = await http.get<ApiResponse<PaginatedResult<TravelRouteInfo>>>(
    `/routes?${query.toString()}`,
  );
  return normalizePaginatedResult(data.data, { page: params.page, pageSize: params.pageSize });
}

export interface FetchRouteCommentsParams {
  limit?: number;
  sort?: 'hot' | 'recent';
}

/**
 * 获取路线评论列表（管理端精选运营）。
 *
 * @param routeId - 路线 ID
 * @param params - 排序与条数
 * @returns 评论列表
 */
export async function fetchRouteComments(routeId: number, params: FetchRouteCommentsParams = {}) {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.sort) qs.set('sort', params.sort);
  const query = qs.toString();
  const { data } = await http.get<ApiResponse<RouteCommentInfo[]>>(
    `/routes/${routeId}/comments${query ? `?${query}` : ''}`,
  );
  return data.data;
}

/**
 * 设置评论精选状态（需 content:attractions:pending 权限）。
 *
 * @param routeId - 路线 ID
 * @param commentId - 评论 ID
 * @param featured - 是否精选
 * @returns 更新后的评论
 */
export async function setRouteCommentFeatured(
  routeId: number,
  commentId: number,
  featured: boolean,
) {
  const { data } = await http.patch<ApiResponse<RouteCommentInfo>>(
    `/routes/${routeId}/comments/${commentId}/featured`,
    { featured },
  );
  return data.data;
}

export interface FetchUgcReportsParams {
  status?: 'open' | 'accepted' | 'rejected';
  page?: number;
  pageSize?: number;
}

/**
 * U5：管理端分页拉取路线报错工单。
 *
 * @param params - 状态与分页
 * @returns 分页工单
 */
export async function fetchUgcReportsPage(params: FetchUgcReportsParams = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page != null) query.set('page', String(params.page));
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  const { data } = await http.get<ApiResponse<PaginatedResult<RouteReportInfo>>>(
    `/routes/admin/ugc-reports${qs ? `?${qs}` : ''}`,
  );
  return normalizePaginatedResult(data.data, {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  });
}

/**
 * U5：采纳报错工单。
 *
 * @param reportId - 工单 ID
 * @param note - 处理备注
 * @returns 更新后的工单
 */
export async function acceptUgcReport(reportId: number, note?: string | null) {
  const { data } = await http.post<ApiResponse<RouteReportInfo>>(
    `/routes/admin/ugc-reports/${reportId}/accept`,
    { note: note ?? null },
  );
  return data.data;
}

/**
 * U5：驳回报错工单。
 *
 * @param reportId - 工单 ID
 * @param note - 处理备注
 * @returns 更新后的工单
 */
export async function rejectUgcReport(reportId: number, note?: string | null) {
  const { data } = await http.post<ApiResponse<RouteReportInfo>>(
    `/routes/admin/ugc-reports/${reportId}/reject`,
    { note: note ?? null },
  );
  return data.data;
}

/**
 * U5：拉取抽检队列。
 *
 * @param limit - 条数上限
 * @returns 抽检条目
 */
export async function fetchUgcSpotCheck(limit = 50) {
  const { data } = await http.get<ApiResponse<{ items: RouteSpotCheckItem[] }>>(
    `/routes/admin/ugc-spot-check?limit=${limit}`,
  );
  return data.data.items;
}

/**
 * U5：对路线执行运营处置。
 *
 * @param routeId - 路线 ID
 * @param action - 处置动作
 * @returns 更新后的路线
 */
export async function applyRouteModeration(routeId: number, action: RouteModerationActionValue) {
  const { data } = await http.post<ApiResponse<TravelRouteInfo>>(
    `/routes/admin/${routeId}/moderation`,
    { action },
  );
  return data.data;
}
