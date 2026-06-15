import http from './http';
import { normalizePaginatedResult, type ApiResponse, type PaginatedResult, type TravelRouteInfo } from '@douxing/shared';

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
