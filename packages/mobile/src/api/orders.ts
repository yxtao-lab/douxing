import type { OrderInfo, OrderPrepayResult } from '@douxing/shared';
import { request } from '@/utils/request';

export function createUnlockOrder(routeId: number) {
  return request<OrderInfo>('/orders', { method: 'POST', data: { routeId } });
}

export function createOrderPrepay(orderId: number, data?: { wxCode?: string }) {
  return request<OrderPrepayResult>(`/orders/${orderId}/prepay`, {
    method: 'POST',
    data: data ?? {},
  });
}

export function payOrder(orderId: number) {
  return request<OrderInfo>(`/orders/${orderId}/pay`, { method: 'POST' });
}

export function fetchOrderById(orderId: number) {
  return request<OrderInfo>(`/orders/${orderId}`);
}

export function cancelOrder(orderId: number) {
  return request<OrderInfo>(`/orders/${orderId}/cancel`, { method: 'POST' });
}

export function fetchOrders() {
  return request<OrderInfo[]>('/orders');
}

export interface OrderPaymentConfig {
  mode: string;
  wechatConfigured: boolean;
}

export function fetchOrderPaymentConfig() {
  return request<OrderPaymentConfig>('/orders/payment-config');
}
