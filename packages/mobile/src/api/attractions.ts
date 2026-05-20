import type { AttractionCitySummary, AttractionInfo } from '@douxing/shared';
import { request } from '@/utils/request';

export function fetchAttractions(params?: {
  city?: string;
  cityCode?: string;
  keyword?: string;
  tags?: string;
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params?.city) query.set('city', params.city);
  if (params?.cityCode) query.set('cityCode', params.cityCode);
  if (params?.keyword) query.set('keyword', params.keyword);
  if (params?.tags) query.set('tags', params.tags);
  if (params?.limit != null) query.set('limit', String(params.limit));
  if (params?.offset != null) query.set('offset', String(params.offset));
  const qs = query.toString();
  return request<AttractionInfo[]>(`/attractions${qs ? `?${qs}` : ''}`);
}

export function fetchAttractionDetail(id: number) {
  return request<AttractionInfo>(`/attractions/${id}`);
}

export function fetchAttractionCities() {
  return request<AttractionCitySummary[]>('/attractions/cities');
}
