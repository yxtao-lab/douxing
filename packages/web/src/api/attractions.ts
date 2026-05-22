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
