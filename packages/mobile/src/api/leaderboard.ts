import type { LeaderboardResult } from '@douxing/shared';
import { request } from '@/utils/request';
import { buildQueryString } from '@/utils/query-string';

export function fetchLeaderboard(params?: {
  period?: 'week' | 'month';
  metric?: 'checkins' | 'points';
  limit?: number;
}) {
  const qs = buildQueryString({
    period: params?.period,
    metric: params?.metric,
    limit: params?.limit,
  });
  return request<LeaderboardResult>(`/leaderboard${qs}`);
}
