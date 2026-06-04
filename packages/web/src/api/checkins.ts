import http from './http';
import {
  normalizePaginatedResult,
  type ApiResponse,
  type CheckInInfo,
  type PaginatedResult,
} from '@douxing/shared';

export async function fetchCheckInsPage(params: {
  page: number;
  pageSize: number;
  all?: boolean;
}) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.all) query.set('all', '1');
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
