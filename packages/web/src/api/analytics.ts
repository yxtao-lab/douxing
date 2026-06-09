import http from './http';
import type {
  AnalyticsCityRankItem,
  AnalyticsDailyPoint,
  AnalyticsOverview,
  ApiResponse,
} from '@douxing/shared';

export async function fetchAnalyticsOverview() {
  const { data } = await http.get<ApiResponse<AnalyticsOverview>>('/analytics/overview');
  return data.data;
}

export async function fetchAnalyticsTrends(days = 30) {
  const { data } = await http.get<ApiResponse<AnalyticsDailyPoint[]>>('/analytics/trends', {
    params: { days },
  });
  return data.data;
}

export async function fetchTopCheckinCities(limit = 10) {
  const { data } = await http.get<ApiResponse<AnalyticsCityRankItem[]>>('/analytics/top-cities', {
    params: { limit },
  });
  return data.data;
}
