import http from './http';
import {
  normalizePaginatedResult,
  type ApiResponse,
  type PaginatedResult,
  type RouteCommentInfo,
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
