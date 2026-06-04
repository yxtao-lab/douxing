import http from './http';
import { normalizePaginatedResult, type ApiResponse, type PaginatedResult, type TravelRouteInfo } from '@douxing/shared';

export async function fetchRoutesPage(page: number, pageSize: number) {
  const { data } = await http.get<ApiResponse<PaginatedResult<TravelRouteInfo>>>(
    `/routes?all=1&page=${page}&pageSize=${pageSize}`,
  );
  return normalizePaginatedResult(data.data, { page, pageSize });
}
