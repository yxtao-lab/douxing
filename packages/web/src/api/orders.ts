import http from './http';
import { normalizePaginatedResult, type ApiResponse, type OrderInfo, type PaginatedResult } from '@douxing/shared';

export interface AdminOrderListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  orderType?: string;
  status?: number;
  userId?: number;
  dateStart?: string;
  dateEnd?: string;
}

function appendOrderQuery(query: URLSearchParams, params: AdminOrderListParams) {
  query.set('all', '1');
  query.set('page', String(params.page));
  query.set('pageSize', String(params.pageSize));
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.orderType) query.set('orderType', params.orderType);
  if (params.status != null) query.set('status', String(params.status));
  if (params.userId != null) query.set('userId', String(params.userId));
  if (params.dateStart) query.set('dateStart', params.dateStart);
  if (params.dateEnd) query.set('dateEnd', params.dateEnd);
}

export async function fetchOrdersPage(params: AdminOrderListParams) {
  const query = new URLSearchParams();
  appendOrderQuery(query, params);
  const { data } = await http.get<ApiResponse<PaginatedResult<OrderInfo>>>(`/orders?${query.toString()}`);
  return normalizePaginatedResult(data.data, { page: params.page, pageSize: params.pageSize });
}
