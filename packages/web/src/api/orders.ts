import http from './http';
import type { ApiResponse, OrderInfo, PaginatedResult } from '@douxing/shared';

export async function fetchOrdersPage(page: number, pageSize: number) {
  const { data } = await http.get<ApiResponse<PaginatedResult<OrderInfo>>>(
    `/orders?all=1&page=${page}&pageSize=${pageSize}`,
  );
  return data.data;
}
