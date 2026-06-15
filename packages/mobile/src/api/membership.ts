import type {
  MembershipInfo,
  MembershipProduct,
  MembershipChangeLog,
  OrderInfo,
  PaginatedResult,
} from '@douxing/shared';
import { request } from '@/utils/request';

export function fetchMembershipProducts() {
  return request<MembershipProduct[]>('/membership/products');
}

export function createMembershipOrder(targetLevel: number) {
  return request<OrderInfo>('/membership/orders', {
    method: 'POST',
    data: { targetLevel },
  });
}

export function fetchMembershipLogsPage(page: number, pageSize: number) {
  return request<PaginatedResult<MembershipChangeLog>>(
    `/membership/logs?page=${page}&pageSize=${pageSize}`,
  );
}

export type { MembershipInfo, MembershipProduct };
