import http from './http';
import type { ApiResponse, TravelRouteInfo } from '@douxing/shared';

/** D5-a：公开路线只读摘要（无需登录） */
export async function fetchSharedRoute(id: number) {
  const { data } = await http.get<ApiResponse<TravelRouteInfo>>(`/share/routes/${id}`);
  return data.data;
}

/** 海报 QR 兜底：微信 URL Link */
export async function fetchRouteShareLink(id: number) {
  const { data } = await http.get<ApiResponse<{ url: string }>>(`/share/routes/${id}/link`);
  return data.data;
}
