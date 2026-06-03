import http from './http';
import type { ApiResponse, AttractionInfo, PaginatedResult } from '@douxing/shared';

export async function fetchPendingAttractionsPage(page: number, pageSize: number) {
  const { data } = await http.get<ApiResponse<PaginatedResult<AttractionInfo>>>(
    `/attractions/admin/pending?page=${page}&pageSize=${pageSize}`,
  );
  return data.data;
}

export async function approveAttraction(id: number) {
  const { data } = await http.post<ApiResponse<AttractionInfo>>(
    `/attractions/admin/${id}/approve`,
  );
  return data.data;
}

export async function fetchAdminAttractionCatalogPage(params: {
  page: number;
  pageSize: number;
  city?: string;
  keyword?: string;
}) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.city) query.set('city', params.city);
  if (params.keyword) query.set('keyword', params.keyword);
  const { data } = await http.get<ApiResponse<PaginatedResult<AttractionInfo>>>(
    `/attractions/admin/catalog?${query.toString()}`,
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

export async function refreshAttractionCoverFromAmap(id: number) {
  const { data } = await http.post<ApiResponse<AttractionInfo>>(
    `/attractions/admin/${id}/cover/refresh-amap`,
  );
  return data.data;
}
