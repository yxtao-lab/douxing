import http from './http';
import type { ApiResponse, LeaderboardResult } from '@douxing/shared';

export async function fetchLeaderboard(params?: {
  period?: 'week' | 'month';
  metric?: 'checkins' | 'points';
  limit?: number;
}) {
  const parts: string[] = [];
  if (params?.period) parts.push(`period=${params.period}`);
  if (params?.metric) parts.push(`metric=${params.metric}`);
  if (params?.limit != null) parts.push(`limit=${params.limit}`);
  const qs = parts.length > 0 ? `?${parts.join('&')}` : '';
  const { data } = await http.get<ApiResponse<LeaderboardResult>>(`/leaderboard${qs}`);
  return data.data;
}
