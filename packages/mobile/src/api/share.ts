import type { TravelRouteInfo } from '@douxing/shared';
import { request } from '@/utils/request';

/** D5-a：公开路线只读摘要（无需登录） */
export function fetchSharedRoute(id: number) {
  return request<TravelRouteInfo>(`/share/routes/${id}`);
}

/** 海报 QR 兜底：微信 URL Link（无 H5 且小程序码图片加载失败时） */
export function fetchRouteShareLink(id: number) {
  return request<{ url: string }>(`/share/routes/${id}/link`);
}
