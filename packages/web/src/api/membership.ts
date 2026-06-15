import http from './http';
import {
  normalizePaginatedResult,
  type AdminMembershipUserRow,
  type ApiResponse,
  type MembershipChangeLog,
  type MembershipProduct,
  type PaginatedResult,
} from '@douxing/shared';

export async function fetchMembershipProducts() {
  const { data } = await http.get<ApiResponse<MembershipProduct[]>>('/system/membership/products');
  return data.data;
}

export async function fetchMembershipUsersPage(
  page: number,
  pageSize: number,
  filters?: { keyword?: string; level?: number },
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (filters?.keyword) params.set('keyword', filters.keyword);
  if (filters?.level != null) params.set('level', String(filters.level));
  const { data } = await http.get<ApiResponse<PaginatedResult<AdminMembershipUserRow>>>(
    `/system/membership/users?${params}`,
  );
  return normalizePaginatedResult(data.data, { page, pageSize });
}

export async function fetchMembershipLogsPage(
  page: number,
  pageSize: number,
  filters?: { keyword?: string; source?: string; userId?: number },
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (filters?.keyword) params.set('keyword', filters.keyword);
  if (filters?.source) params.set('source', filters.source);
  if (filters?.userId != null) params.set('userId', String(filters.userId));
  const { data } = await http.get<ApiResponse<PaginatedResult<MembershipChangeLog>>>(
    `/system/membership/logs?${params}`,
  );
  return normalizePaginatedResult(data.data, { page, pageSize });
}

export async function updateMembershipUser(
  userId: number,
  payload: { memberLevel: number; memberExpiresAt?: string | null; remark?: string },
) {
  await http.patch(`/system/membership/users/${userId}`, payload);
}
