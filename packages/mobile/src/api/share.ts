import type { TravelRouteInfo } from '@douxing/shared';
import { request } from '@/utils/request';

/** D5-a：公开路线只读摘要（无需登录） */
export function fetchSharedRoute(id: number) {
  return request<TravelRouteInfo>(`/share/routes/${id}`);
}

/** 海报 QR 兜底：微信 URL Link（小程序码不可用时画标准 QR / H5 唤起小程序） */
export function fetchRouteShareLink(id: number) {
  return request<{ url: string }>(`/share/routes/${id}/link`);
}
