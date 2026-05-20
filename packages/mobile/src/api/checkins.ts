import type { CheckInInfo, CheckInResult } from '@douxing/shared';
import { request } from '@/utils/request';

export function createCheckIn(data: {
  routeId: number;
  attractionId?: number;
  location: { placeName: string; address?: string; latitude?: number; longitude?: number };
  remark?: string;
}) {
  return request<CheckInResult>('/checkins', { method: 'POST', data });
}

export function fetchCheckIns(routeId?: number) {
  const query = routeId ? `?routeId=${routeId}` : '';
  return request<CheckInInfo[]>(`/checkins${query}`);
}
