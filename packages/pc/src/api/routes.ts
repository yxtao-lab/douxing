import http from './http';
import { requestAiPlan } from './ai-plan';
import {
  normalizePaginatedResult,
  type ApiResponse,
  type CreateRouteCommentRequest,
  type LlmProviderOption,
  type LlmStatusInfo,
  type PaginatedResult,
  type RegenerateRouteRequest,
  type RouteCommentInfo,
  type RouteFavoriteResult,
  type RouteLikeResult,
  type RouteListQuery,
  type RouteListSort,
  type RoutePath,
  type RouteReplanContextInput,
  type RouteReplanPreviewResponse,
  type RouteMissedPoiAnalyzeInput,
  type RouteMissedPoiAnalyzeResponse,
  type RouteMissedPoiRecordInput,
  type RouteMissedPoiRecordResponse,
  type SetRoutePublicShareRequest,
  type TravelRouteInfo,
  type UpdateRouteDraftRequest,
} from '@douxing/shared';

export interface GenerateRouteResult extends TravelRouteInfo {
  generationSource?: 'llm' | 'template';
  llmProvider?: 'deepseek' | 'lmstudio' | 'ai-service';
}

export async function fetchLlmProviders() {
  const { data } = await http.get<ApiResponse<{ options: LlmProviderOption[] }>>(
    '/routes/llm-providers',
  );
  return data.data;
}

export async function fetchLlmStatus() {
  const { data } = await http.get<ApiResponse<LlmStatusInfo>>('/routes/llm-status');
  return data.data;
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

export async function fetchRoutesPage(query?: RouteListQuery) {
  const { data } = await http.get<ApiResponse<PaginatedResult<TravelRouteInfo>>>(
    `/routes${buildRouteListQuery(query)}`,
  );
  return normalizePaginatedResult(data.data, {
    page: query?.page ?? 1,
    pageSize: query?.pageSize ?? query?.limit ?? 20,
  });
}

export async function fetchPlazaRoutesPage(page = 1, pageSize = 20, sort: RouteListSort = 'hot') {
  const { data } = await http.get<ApiResponse<PaginatedResult<TravelRouteInfo>>>(
    `/routes/plaza?page=${page}&pageSize=${pageSize}&sort=${sort}`,
  );
  return normalizePaginatedResult(data.data, { page, pageSize });
}

export async function fetchRouteDetail(id: number) {
  const { data } = await http.get<ApiResponse<TravelRouteInfo>>(`/routes/${id}`);
  return data.data;
}

export async function fetchRouteMapPath(id: number, dayIndex?: number) {
  const query =
    dayIndex !== undefined && Number.isFinite(dayIndex) ? `?day=${dayIndex}` : '';
  const { data } = await http.get<ApiResponse<RoutePath>>(`/routes/${id}/map-path${query}`);
  return data.data;
}

export async function publishRoute(id: number) {
  const { data } = await http.post<ApiResponse<TravelRouteInfo>>(`/routes/${id}/publish`);
  return data.data;
}

export async function regenerateRoute(id: number, body: RegenerateRouteRequest) {
  return requestAiPlan<GenerateRouteResult>(`/routes/${id}/regenerate`, {
    method: 'POST',
    data: body,
    loadingMessageKey: 'routes.regenerating',
  });
}

export async function updateRouteDraft(id: number, body: UpdateRouteDraftRequest) {
  const { data } = await http.put<ApiResponse<TravelRouteInfo>>(`/routes/${id}`, body);
  return data.data;
}

export async function toggleRouteLike(id: number) {
  const { data } = await http.post<ApiResponse<RouteLikeResult>>(`/routes/${id}/like`);
  return data.data;
}

export async function toggleRouteFavorite(id: number) {
  const { data } = await http.post<ApiResponse<RouteFavoriteResult>>(`/routes/${id}/favorite`);
  return data.data;
}

export async function setRoutePublicShare(id: number, body: SetRoutePublicShareRequest) {
  const { data } = await http.post<ApiResponse<TravelRouteInfo>>(`/routes/${id}/share`, body);
  return data.data;
}

export async function fetchRouteComments(id: number, limit = 50) {
  const { data } = await http.get<ApiResponse<RouteCommentInfo[]>>(
    `/routes/${id}/comments?limit=${limit}`,
  );
  return data.data;
}

export async function createRouteComment(id: number, body: CreateRouteCommentRequest) {
  const { data } = await http.post<ApiResponse<RouteCommentInfo>>(`/routes/${id}/comments`, body);
  return data.data;
}

export async function previewRouteReplan(id: number, body: { context: RouteReplanContextInput }) {
  const { data } = await http.post<ApiResponse<RouteReplanPreviewResponse>>(
    `/routes/${id}/replan/preview`,
    body,
  );
  return data.data;
}

export async function applyRouteReplan(id: number, body: { context: RouteReplanContextInput }) {
  const { data } = await http.post<ApiResponse<TravelRouteInfo>>(`/routes/${id}/replan/apply`, body);
  return data.data;
}

export async function analyzeRouteMissedPois(id: number, body: RouteMissedPoiAnalyzeInput) {
  const { data } = await http.post<ApiResponse<RouteMissedPoiAnalyzeResponse>>(
    `/routes/${id}/missed-pois/analyze`,
    body,
  );
  return data.data;
}

export async function recordRouteMissedPois(id: number, body: RouteMissedPoiRecordInput) {
  const { data } = await http.post<ApiResponse<RouteMissedPoiRecordResponse>>(
    `/routes/${id}/missed-pois/record`,
    body,
  );
  return data.data;
}
