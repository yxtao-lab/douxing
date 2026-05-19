import http from './http';
import type { ApiResponse, OrderInfo } from '@douxing/shared';

export async function fetchAllOrders() {
  const { data } = await http.get<ApiResponse<OrderInfo[]>>('/orders?all=1');
  return data.data;
}
