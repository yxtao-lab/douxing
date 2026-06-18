import type {
  TravelRouteInfo,
  GenerateRouteRequest,
  RegenerateRouteRequest,
  LlmStatusInfo,
  LlmProviderOption,
  RouteListQuery,
  RouteListSort,
  PaginatedResult,
  UpdateRouteDraftRequest,
  RouteLikeResult,
  RouteFavoriteResult,
  SetRoutePublicShareRequest,
  RouteCommentInfo,
  CreateRouteCommentRequest,
  RoutePath,
  RouteReplanContextInput,
  RouteReplanPreviewResponse,
  RouteMissedPoiAnalyzeInput,
  RouteMissedPoiAnalyzeResponse,
  RouteMissedPoiRecordInput,
  RouteMissedPoiRecordResponse,
} from '@douxing/shared';
import { request, requestAiPlan } from '@/utils/request';

export interface GenerateRouteResult extends TravelRouteInfo {
  generationSource?: 'llm' | 'template';
  llmProvider?: 'deepseek' | 'lmstudio' | 'ai-service';
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
    loadingMessageKey: 'plan.aiPlanning',
  });
}

function buildRouteListQuery(query?: RouteListQuery): string {
  const parts: string[] = [];
  if (query?.scope) parts.push(`scope=${encodeURIComponent(query.scope)}`);
  if (query?.status !== undefined && query.status !== null) {
    parts.push(`status=${query.status}`);
  }
  if (query?.sort) parts.push(`sort=${encodeURIComponent(query.sort)}`);
  if (query?.keyword?.trim()) parts.push(`keyword=${encodeURIComponent(query.keyword.trim())}`);
  if (query?.page != null) parts.push(`page=${query.page}`);
  if (query?.pageSize != null) parts.push(`pageSize=${query.pageSize}`);
  else if (query?.limit !== undefined) parts.push(`pageSize=${query.limit}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function fetchRoutesPage(query?: RouteListQuery) {
  return request<PaginatedResult<TravelRouteInfo>>(`/routes${buildRouteListQuery(query)}`);
}

/** @deprecated 请使用 fetchRoutesPage */
export function fetchRoutes(query?: RouteListQuery) {
  return fetchRoutesPage(query);
}

export function fetchPlazaRoutesPage(page = 1, pageSize = 20, sort: RouteListSort = 'hot') {
  return request<PaginatedResult<TravelRouteInfo>>(
    `/routes/plaza?page=${page}&pageSize=${pageSize}&sort=${sort}`,
  );
}

/** @deprecated 使用 fetchPlazaRoutesPage */
export function fetchPlazaRoutes(limit = 20, sort: RouteListSort = 'hot') {
  return fetchPlazaRoutesPage(1, limit, sort);
}

/** @deprecated 使用 fetchPlazaRoutes */
export function fetchHotRoutes(limit = 20) {
  return fetchPlazaRoutes(limit);
}

export function fetchRouteDetail(id: number) {
  return request<TravelRouteInfo>(`/routes/${id}`);
}

export function fetchRouteMapPath(id: number, dayIndex?: number) {
  const query =
    dayIndex !== undefined && Number.isFinite(dayIndex) ? `?day=${dayIndex}` : '';
  return request<RoutePath>(`/routes/${id}/map-path${query}`);
}

export function publishRoute(id: number) {
  return request<TravelRouteInfo>(`/routes/${id}/publish`, { method: 'POST' });
}

export function regenerateRoute(id: number, data: RegenerateRouteRequest) {
  return requestAiPlan<GenerateRouteResult>(`/routes/${id}/regenerate`, {
    method: 'POST',
    data,
    loadingMessageKey: 'plan.aiPlanningRegenerate',
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

export function previewRouteReplan(id: number, data: { context: RouteReplanContextInput }) {
  return request<RouteReplanPreviewResponse>(`/routes/${id}/replan/preview`, {
    method: 'POST',
    data,
  });
}

export function applyRouteReplan(id: number, data: { context: RouteReplanContextInput }) {
  return request<TravelRouteInfo>(`/routes/${id}/replan/apply`, { method: 'POST', data });
}

export function analyzeRouteMissedPois(id: number, data: RouteMissedPoiAnalyzeInput) {
  return request<RouteMissedPoiAnalyzeResponse>(`/routes/${id}/missed-pois/analyze`, {
    method: 'POST',
    data,
  });
}

export function recordRouteMissedPois(id: number, data: RouteMissedPoiRecordInput) {
  return request<RouteMissedPoiRecordResponse>(`/routes/${id}/missed-pois/record`, {
    method: 'POST',
    data,
  });
}
