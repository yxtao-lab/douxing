import type {
  TravelRouteInfo,
  GenerateRouteRequest,
  RegenerateRouteRequest,
  LlmStatusInfo,
  LlmProviderOption,
  RouteListQuery,
  RouteListSort,
  UpdateRouteDraftRequest,
  RouteLikeResult,
  RouteFavoriteResult,
  SetRoutePublicShareRequest,
  RouteCommentInfo,
  CreateRouteCommentRequest,
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

function buildRouteListQuery(query?: RouteListQuery): string {
  const parts: string[] = [];
  if (query?.scope) parts.push(`scope=${encodeURIComponent(query.scope)}`);
  if (query?.status !== undefined && query.status !== null) {
    parts.push(`status=${query.status}`);
  }
  if (query?.sort) parts.push(`sort=${encodeURIComponent(query.sort)}`);
  if (query?.limit !== undefined) parts.push(`limit=${query.limit}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function fetchRoutes(query?: RouteListQuery) {
  return request<TravelRouteInfo[]>(`/routes${buildRouteListQuery(query)}`);
}

export function fetchPlazaRoutes(limit = 20, sort: RouteListSort = 'hot') {
  return request<TravelRouteInfo[]>(`/routes/plaza?limit=${limit}&sort=${sort}`);
}

/** @deprecated 使用 fetchPlazaRoutes */
export function fetchHotRoutes(limit = 20) {
  return fetchPlazaRoutes(limit);
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

export function updateRouteDraft(id: number, data: UpdateRouteDraftRequest) {
  return request<TravelRouteInfo>(`/routes/${id}`, { method: 'PUT', data });
}

export function toggleRouteLike(id: number) {
  return request<RouteLikeResult>(`/routes/${id}/like`, { method: 'POST' });
}

export function toggleRouteFavorite(id: number) {
  return request<RouteFavoriteResult>(`/routes/${id}/favorite`, { method: 'POST' });
}

export function setRoutePublicShare(id: number, data: SetRoutePublicShareRequest) {
  return request<TravelRouteInfo>(`/routes/${id}/share`, { method: 'POST', data });
}

export function fetchRouteComments(id: number, limit = 50) {
  return request<RouteCommentInfo[]>(`/routes/${id}/comments?limit=${limit}`);
}

export function createRouteComment(id: number, data: CreateRouteCommentRequest) {
  return request<RouteCommentInfo>(`/routes/${id}/comments`, { method: 'POST', data });
}
