import http from './http';
import type { ApiResponse, AttractionInfo } from '@douxing/shared';

export async function fetchPendingAttractions(limit = 50) {
  const { data } = await http.get<ApiResponse<AttractionInfo[]>>(
    `/attractions/admin/pending?limit=${limit}`,
  );
  return data.data;
}

export async function approveAttraction(id: number) {
  const { data } = await http.post<ApiResponse<AttractionInfo>>(
    `/attractions/admin/${id}/approve`,
  );
  return data.data;
}

export async function fetchAdminAttractionCatalog(params?: {
  city?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params?.city) query.set('city', params.city);
  if (params?.keyword) query.set('keyword', params.keyword);
  if (params?.limit != null) query.set('limit', String(params.limit));
  if (params?.offset != null) query.set('offset', String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const { data } = await http.get<ApiResponse<AttractionInfo[]>>(
    `/attractions/admin/catalog${suffix}`,
  );
  return data.data;
}

export async function uploadAttractionCover(id: number, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await http.post<ApiResponse<AttractionInfo>>(
    `/attractions/admin/${id}/cover`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}
