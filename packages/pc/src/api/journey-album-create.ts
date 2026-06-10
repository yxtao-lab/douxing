import http from './http';
import type { ApiResponse, JourneyAlbumSummary } from '@douxing/shared';

/** 创建旅程相册（关联路线） */
export async function createJourneyAlbum(routeId: number, title?: string) {
  const { data } = await http.post<ApiResponse<JourneyAlbumSummary>>('/journey-albums', {
    routeId,
    title,
  });
  return data.data;
}
