import http from './http';
import type { ApiResponse, CheckInInfo } from '@douxing/shared';

export async function fetchAllCheckIns() {
  const { data } = await http.get<ApiResponse<CheckInInfo[]>>('/checkins?all=1');
  return data.data;
}

export async function fetchAllCheckInsForMap(limit = 500) {
  const { data } = await http.get<ApiResponse<CheckInInfo[]>>(
    `/checkins?all=1&limit=${limit}`,
  );
  return data.data;
}
