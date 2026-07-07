import http from './http';
import type { ApiResponse, RouteMediaInfo, RouteMediaPendingInfo } from '@douxing/shared';

/**
 * 拉取待审核路线短视频列表（H10-b · 运营端）。
 *
 * @param limit - 最大条数（1～100，默认 50）
 * @returns 待审媒体列表；无数据时为空数组
 */
export async function fetchPendingRouteMedia(limit = 50): Promise<RouteMediaPendingInfo[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const { data } = await http.get<ApiResponse<RouteMediaPendingInfo[]>>(
    `/attractions/admin/media/pending?limit=${safeLimit}`,
  );
  return data.data ?? [];
}

/**
 * 审核路线短视频（通过或拒绝）。
 *
 * @param mediaId - 媒体 ID
 * @param status - CheckInStatus：1 通过 / 2 拒绝
 * @returns 更新后的媒体记录
 */
export async function reviewRouteMedia(mediaId: number, status: number): Promise<RouteMediaInfo> {
  const { data } = await http.patch<ApiResponse<RouteMediaInfo>>(
    `/attractions/admin/media/${mediaId}/review`,
    { status },
  );
  return data.data;
}
