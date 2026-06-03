import http from './http';
import type { ApiResponse, PaginatedResult, TravelRouteInfo } from '@douxing/shared';

export async function fetchRoutesPage(page: number, pageSize: number) {
  const { data } = await http.get<ApiResponse<PaginatedResult<TravelRouteInfo>>>(
    `/routes?all=1&page=${page}&pageSize=${pageSize}`,
  );
  return data.data;
}
