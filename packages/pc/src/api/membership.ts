import http from './http';
import type { ApiResponse, MembershipInfo, MembershipProduct, OrderInfo } from '@douxing/shared';
import { continuePayForOrder } from '@/api/orders';

export async function createMembershipOrder(targetLevel: number) {
  const { data } = await http.post<ApiResponse<OrderInfo>>('/membership/orders', { targetLevel });
  return data.data;
}

/** PC 端会员升级：创建订单 → 模拟支付 */
export async function completeMembershipUpgradePayment(targetLevel: number) {
  const order = await createMembershipOrder(targetLevel);
  return continuePayForOrder(order.id);
}

export async function fetchMembershipInfoDirect() {
  const { data } = await http.get<ApiResponse<MembershipInfo>>('/membership/me');
  return data.data;
}

export async function fetchMembershipProducts() {
  const { data } = await http.get<ApiResponse<MembershipProduct[]>>('/membership/products');
  return data.data;
}
