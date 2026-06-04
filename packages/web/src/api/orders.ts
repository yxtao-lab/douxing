import http from './http';
import { normalizePaginatedResult, type ApiResponse, type OrderInfo, type PaginatedResult } from '@douxing/shared';

export async function fetchOrdersPage(page: number, pageSize: number) {
  const { data } = await http.get<ApiResponse<PaginatedResult<OrderInfo>>>(
    `/orders?all=1&page=${page}&pageSize=${pageSize}`,
  );
  return normalizePaginatedResult(data.data, { page, pageSize });
}
