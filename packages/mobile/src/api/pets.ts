import type { TravelPetFloatingContext, TravelPetInfo } from '@douxing/shared';
import { request } from '@/utils/request';

export function fetchTravelPetMe() {
  return request<TravelPetInfo>('/pets/me');
}

/** H3-b：与规划 orchestrator 共用 memory 召回 */
export function fetchTravelPetFloatingContext() {
  return request<TravelPetFloatingContext>('/pets/me/floating-context');
}
