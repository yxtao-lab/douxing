import http from './http';
import type { ApiResponse, RoutePlaybookInfo } from '@douxing/shared';

export async function fetchAdminPlaybooks(params?: {
  city?: string;
  keyword?: string;
  enabled?: boolean;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.city) query.set('city', params.city);
  if (params?.keyword) query.set('keyword', params.keyword);
  if (params?.enabled != null) query.set('enabled', String(params.enabled));
  if (params?.limit != null) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const { data } = await http.get<ApiResponse<RoutePlaybookInfo[]>>(`/playbooks/admin${suffix}`);
  return data.data;
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
