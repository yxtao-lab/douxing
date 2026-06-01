import type { TravelRouteInfo } from '@douxing/shared';
import { request } from '@/utils/request';

/** D5-a：公开路线只读摘要（无需登录） */
export function fetchSharedRoute(id: number) {
  return request<TravelRouteInfo>(`/share/routes/${id}`);
}
