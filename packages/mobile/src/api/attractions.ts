import type { AttractionCitySummary, AttractionInfo } from '@douxing/shared';
import { request } from '@/utils/request';
import { buildQueryString } from '@/utils/query-string';

export function fetchAttractions(params?: {
  city?: string;
  cityCode?: string;
  category?: 'attraction' | 'restaurant' | 'hotel';
  keyword?: string;
  tags?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = buildQueryString({
    city: params?.city,
    category: params?.category,
    cityCode: params?.cityCode,
    keyword: params?.keyword,
    tags: params?.tags,
    limit: params?.limit,
    offset: params?.offset,
  });
  return request<AttractionInfo[]>(`/attractions${qs}`);
}

export function fetchAttractionDetail(id: number) {
  return request<AttractionInfo>(`/attractions/${id}`);
}

export function fetchAttractionCities() {
  return request<AttractionCitySummary[]>('/attractions/cities');
}
