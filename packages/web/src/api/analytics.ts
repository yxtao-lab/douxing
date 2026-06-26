import http from './http';
import type {
  AnalyticsCityRankItem,
  AnalyticsDailyPoint,
  AnalyticsFunnelStep,
  AnalyticsGeoDistribution,
  AnalyticsGeoFlow,
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

export async function fetchAnalyticsFunnel(days = 30) {
  const { data } = await http.get<ApiResponse<AnalyticsFunnelStep[]>>('/analytics/funnel', {
    params: { days },
  });
  return data.data;
}

export async function fetchAnalyticsGeoDistribution(days = 30) {
  const { data } = await http.get<ApiResponse<AnalyticsGeoDistribution>>('/analytics/geo/distribution', {
    params: { days },
  });
  return data.data;
}

export async function fetchAnalyticsGeoFlows(days = 30, limit = 20) {
  const { data } = await http.get<ApiResponse<AnalyticsGeoFlow[]>>('/analytics/geo/flows', {
    params: { days, limit },
  });
  return data.data;
}
