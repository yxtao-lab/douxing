import http from './http';
import {
  normalizePaginatedResult,
  type ApiResponse,
  type PaginatedResult,
  type RoutePlaybookInfo,
} from '@douxing/shared';

export async function fetchAdminPlaybooksPage(params: {
  page: number;
  pageSize: number;
  city?: string;
  keyword?: string;
  enabled?: boolean;
}) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.city) query.set('city', params.city);
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.enabled != null) query.set('enabled', String(params.enabled));
  const { data } = await http.get<ApiResponse<PaginatedResult<RoutePlaybookInfo>>>(
    `/playbooks/admin?${query.toString()}`,
  );
  return normalizePaginatedResult(data.data, {
    page: params.page,
    pageSize: params.pageSize,
  });
}

export async function createPlaybook(body: RoutePlaybookInfo) {
  const { data } = await http.post<ApiResponse<RoutePlaybookInfo>>('/playbooks/admin', body);
  return data.data;
}

export async function updatePlaybook(id: string, body: Partial<RoutePlaybookInfo>) {
  const { data } = await http.put<ApiResponse<RoutePlaybookInfo>>(`/playbooks/admin/${id}`, body);
  return data.data;
}

export async function deletePlaybook(id: string) {
  const { data } = await http.delete<ApiResponse<{ id: string }>>(`/playbooks/admin/${id}`);
  return data.data;
}
