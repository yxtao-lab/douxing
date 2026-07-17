import http from './http';
import {
  normalizePaginatedResult,
  type ApiResponse,
  type AttractionInfo,
  type PaginatedResult,
} from '@douxing/shared';

export interface AdminPendingAttractionListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  city?: string;
  category?: string;
  source?: string;
  missingCoord?: boolean;
  dateStart?: string;
  dateEnd?: string;
}

export async function fetchPendingAttractionsPage(params: AdminPendingAttractionListParams) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.city) query.set('city', params.city);
  if (params.category) query.set('category', params.category);
  if (params.source) query.set('source', params.source);
  if (params.missingCoord != null) query.set('missingCoord', params.missingCoord ? '1' : '0');
  if (params.dateStart) query.set('dateStart', params.dateStart);
  if (params.dateEnd) query.set('dateEnd', params.dateEnd);
  const { data } = await http.get<ApiResponse<PaginatedResult<AttractionInfo>>>(
    `/attractions/admin/pending?${query.toString()}`,
  );
  return normalizePaginatedResult(data.data, {
    page: params.page,
    pageSize: params.pageSize,
  });
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
  return normalizePaginatedResult(data.data, {
    page: params.page,
    pageSize: params.pageSize,
  });
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

/**
 * 更新景点场景标签（P-TAG-01，运营维护）。
 *
 * @param id - 景点 ID
 * @param sceneTags - 场景标签 slug 列表；覆盖现有标签
 */
export async function updateAttractionSceneTags(id: number, sceneTags: string[]) {
  const { data } = await http.patch<ApiResponse<AttractionInfo>>(
    `/attractions/admin/${id}/scene-tags`,
    { sceneTags },
  );
  return data.data;
}
