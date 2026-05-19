import type { OrderInfo } from '@douxing/shared';
import { request } from '@/utils/request';

export function createUnlockOrder(routeId: number) {
  return request<OrderInfo>('/orders', { method: 'POST', data: { routeId } });
}

export function payOrder(orderId: number) {
  return request<OrderInfo>(`/orders/${orderId}/pay`, { method: 'POST' });
}

export function fetchOrders() {
  return request<OrderInfo[]>('/orders');
}
