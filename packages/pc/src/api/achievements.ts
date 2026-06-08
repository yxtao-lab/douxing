import http from './http';
import type { ApiResponse, AchievementCatalogItem } from '@douxing/shared';

export async function fetchAchievementCatalog() {
  const { data } = await http.get<ApiResponse<AchievementCatalogItem[]>>('/achievements/catalog');
  return data.data;
}
