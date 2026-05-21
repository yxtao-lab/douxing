import type {
  TravelRouteInfo,
  GenerateRouteRequest,
  RegenerateRouteRequest,
  LlmStatusInfo,
  LlmProviderOption,
} from '@douxing/shared';
import { request, requestAiPlan } from '@/utils/request';

export interface GenerateRouteResult extends TravelRouteInfo {
  generationSource?: 'llm' | 'template';
  llmProvider?: 'deepseek' | 'lmstudio';
}

export function fetchLlmProviders() {
  return request<{ options: LlmProviderOption[] }>('/routes/llm-providers');
}

export function fetchLlmStatus() {
  return request<LlmStatusInfo>('/routes/llm-status');
}

export function generateRoute(data: GenerateRouteRequest) {
  return requestAiPlan<GenerateRouteResult>('/routes/generate', {
    method: 'POST',
    data,
    loadingMessage: 'AI 正在规划路线…',
  });
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

export function regenerateRoute(id: number, data: RegenerateRouteRequest) {
  return requestAiPlan<GenerateRouteResult>(`/routes/${id}/regenerate`, {
    method: 'POST',
    data,
    loadingMessage: 'AI 正在重新规划路线…',
  });
}
