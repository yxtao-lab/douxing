import http from './http';
import type { ApiResponse, BadgeCatalogItem } from '@douxing/shared';

export async function fetchBadgeCatalog() {
  const { data } = await http.get<ApiResponse<BadgeCatalogItem[]>>('/badges');
  return data.data;
}
