import type { TravelRouteInfo, GenerateRouteRequest, LlmStatusInfo } from '@douxing/shared';
import { request } from '@/utils/request';

export interface GenerateRouteResult extends TravelRouteInfo {
  generationSource?: 'llm' | 'template';
}

export function fetchLlmStatus() {
  return request<LlmStatusInfo>('/routes/llm-status');
}

export function generateRoute(data: GenerateRouteRequest) {
  return request<GenerateRouteResult>('/routes/generate', { method: 'POST', data });
}

export function fetchRoutes() {
  return request<TravelRouteInfo[]>('/routes');
}

export function fetchRouteDetail(id: number) {
  return request<TravelRouteInfo>(`/routes/${id}`);
}

export function publishRoute(id: number) {
  return request<TravelRouteInfo>(`/routes/${id}/publish`, { method: 'POST' });
}
