import http from './http';
import type { ApiResponse, TravelRouteInfo } from '@douxing/shared';

export async function fetchAllRoutes() {
  const { data } = await http.get<ApiResponse<TravelRouteInfo[]>>('/routes?all=1');
  return data.data;
}
