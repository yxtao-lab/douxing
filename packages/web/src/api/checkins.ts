import http from './http';
import type { ApiResponse, CheckInInfo } from '@douxing/shared';

export async function fetchAllCheckIns() {
  const { data } = await http.get<ApiResponse<CheckInInfo[]>>('/checkins?all=1');
  return data.data;
}
