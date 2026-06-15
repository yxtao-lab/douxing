import http from './http';
import {
  normalizePaginatedResult,
  type ApiResponse,
  type CheckInInfo,
  type PaginatedResult,
} from '@douxing/shared';

export interface AdminCheckInListParams {
  page: number;
  pageSize: number;
  all?: boolean;
  keyword?: string;
  userId?: number;
  routeId?: number;
  cityCode?: string;
  dateStart?: string;
  dateEnd?: string;
}

export async function fetchCheckInsPage(params: AdminCheckInListParams) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.all) query.set('all', '1');
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.userId != null) query.set('userId', String(params.userId));
  if (params.routeId != null) query.set('routeId', String(params.routeId));
  if (params.cityCode) query.set('cityCode', params.cityCode);
  if (params.dateStart) query.set('dateStart', params.dateStart);
  if (params.dateEnd) query.set('dateEnd', params.dateEnd);
  const { data } = await http.get<ApiResponse<PaginatedResult<CheckInInfo>>>(
    `/checkins?${query.toString()}`,
  );
  return normalizePaginatedResult(data.data, {
    page: params.page,
    pageSize: params.pageSize,
  });
}

export async function fetchAllCheckInsForMap() {
  const items: CheckInInfo[] = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    const result = await fetchCheckInsPage({ page, pageSize, all: true });
    items.push(...result.items);
    if (!result.hasMore) break;
    page += 1;
  }
  return items;
}
