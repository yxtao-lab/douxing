import type { ApiResponse, TravelPetFloatingContext, TravelPetInfo } from '@douxing/shared';
import http from './http';

export async function fetchTravelPetMe() {
  const { data } = await http.get<ApiResponse<TravelPetInfo>>('/pets/me');
  return data.data;
}

/** H3-b：与规划 orchestrator 共用 memory 召回 */
export async function fetchTravelPetFloatingContext() {
  const { data } = await http.get<ApiResponse<TravelPetFloatingContext>>('/pets/me/floating-context');
  return data.data;
}
