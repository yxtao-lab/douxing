import http from './http';
import type { ApiResponse, OrderInfo, OrderListTab, OrderPrepayResult, PaginatedResult } from '@douxing/shared';
import { normalizePaginatedResult } from '@douxing/shared';

export interface OrderPaymentConfig {
  mode: string;
  wechatConfigured: boolean;
  routeUnlockPaymentRequired: boolean;
}

export async function fetchOrderPaymentConfig() {
  const { data } = await http.get<ApiResponse<OrderPaymentConfig>>('/orders/payment-config');
  return data.data;
}

export async function createUnlockOrder(routeId: number) {
  const { data } = await http.post<ApiResponse<OrderInfo>>('/orders', { routeId });
  return data.data;
}

export async function createOrderPrepay(orderId: number) {
  const { data } = await http.post<ApiResponse<OrderPrepayResult>>(`/orders/${orderId}/prepay`, {});
  return data.data;
}

export async function payOrder(orderId: number) {
  const { data } = await http.post<ApiResponse<OrderInfo>>(`/orders/${orderId}/pay`);
  return data.data;
}

/** PC 端路线解锁：创建订单 → 模拟支付（开发环境） */
export async function completeRouteUnlockPayment(routeId: number) {
  const order = await createUnlockOrder(routeId);
  const prepay = await createOrderPrepay(order.id);
  if (prepay.channel === 'mock') {
    return payOrder(order.id);
  }
  throw new Error('PC 端暂不支持微信支付，请使用模拟支付环境');
}

export async function fetchOrdersPage(page: number, pageSize: number, tab: OrderListTab = 'all') {
  const tabQuery = tab === 'all' ? '' : `&tab=${tab}`;
  const { data } = await http.get<ApiResponse<PaginatedResult<OrderInfo>>>(
    `/orders?page=${page}&pageSize=${pageSize}${tabQuery}`,
  );
  return normalizePaginatedResult(data.data, { page, pageSize });
}

export async function cancelOrder(orderId: number) {
  const { data } = await http.post<ApiResponse<OrderInfo>>(`/orders/${orderId}/cancel`);
  return data.data;
}

/** 继续支付（PC 模拟） */
export async function continuePayForOrder(orderId: number) {
  const prepay = await createOrderPrepay(orderId);
  if (prepay.channel === 'mock') {
    return payOrder(orderId);
  }
  throw new Error('PC 端暂不支持微信支付');
}
