import http from './http';
import type {
  ApiResponse,
  CheckInInfo,
  CheckInTimeRange,
  PaginatedResult,
} from '@douxing/shared';
import { normalizePaginatedResult } from '@douxing/shared';

export async function fetchCheckInsPage(params: {
  page: number;
  pageSize: number;
  routeId?: number;
  range?: CheckInTimeRange;
}) {
  const parts = [`page=${params.page}`, `pageSize=${params.pageSize}`];
  if (params.routeId != null) parts.push(`routeId=${params.routeId}`);
  if (params.range && params.range !== 'all') parts.push(`range=${params.range}`);
  const { data } = await http.get<ApiResponse<PaginatedResult<CheckInInfo>>>(
    `/checkins?${parts.join('&')}`,
  );
  return normalizePaginatedResult(data.data, {
    page: params.page,
    pageSize: params.pageSize,
  });
}

export async function fetchAllCheckInsForMap(range?: CheckInTimeRange) {
  const items: CheckInInfo[] = [];
  let page = 1;
  const pageSize = 50;
  while (true) {
    const result = await fetchCheckInsPage({ page, pageSize, range });
    items.push(...result.items);
    if (!result.hasMore) break;
    page += 1;
  }
  return items;
}
