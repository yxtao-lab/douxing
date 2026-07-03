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
  FetchRouteCommentsParams,
  RoutePath,
  RouteReplanContextInput,
  RouteReplanPreviewResponse,
  RouteMissedPoiAnalyzeInput,
  RouteMissedPoiAnalyzeResponse,
  RouteMissedPoiRecordInput,
  RouteMissedPoiRecordResponse,
  RouteMediaInfo,
  ROUTE_VIDEO_MAX_DURATION_SEC,
} from '@douxing/shared';
import { request, requestAiPlan } from '@/utils/request';
import { getApiBaseUrl, assertRemoteApiBase } from '@/utils/api-base';
import { resolveClientRequestErrorMessage } from '@douxing/shared';
import { getApiAcceptLanguage } from '@/utils/api-locale-header';
import { mobileT } from '@/i18n/mobileT';

const TOKEN_KEY = 'douxing_token';

export interface GenerateRouteResult extends TravelRouteInfo {
  generationSource?: 'llm' | 'template';
  llmProvider?: 'douxing' | 'deepseek' | 'lmstudio' | 'ai-service';
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

export function fetchRouteComments(id: number, params: FetchRouteCommentsParams = {}) {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.dayIndex != null) qs.set('dayIndex', String(params.dayIndex));
  if (params.attractionId != null) qs.set('attractionId', String(params.attractionId));
  const query = qs.toString();
  return request<RouteCommentInfo[]>(`/routes/${id}/comments${query ? `?${query}` : ''}`);
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

export interface UploadRouteMediaParams {
  scope: 'route' | 'poi';
  durationSec: number;
  dayIndex?: number;
  attractionId?: number;
  poiName?: string;
}

/**
 * 拉取路线绑定短视频列表。
 *
 * @param id - 路线 ID
 * @returns 媒体列表；作者可见全部审核状态
 */
export function fetchRouteMedia(id: number) {
  return request<RouteMediaInfo[]>(`/routes/${id}/media`);
}

/**
 * 删除本人上传的路线短视频。
 *
 * @param routeId - 路线 ID
 * @param mediaId - 媒体 ID
 */
export function deleteRouteMedia(routeId: number, mediaId: number) {
  return request<{ deleted: boolean }>(`/routes/${routeId}/media/${mediaId}`, {
    method: 'DELETE',
  });
}

/**
 * 上传路线或 POI 绑定短视频（≤60s）。
 *
 * @param routeId - 路线 ID
 * @param filePath - 本地临时视频路径
 * @param params - 绑定范围与时长
 * @returns 上传后的媒体记录
 */
export function uploadRouteVideo(
  routeId: number,
  filePath: string,
  params: UploadRouteMediaParams,
): Promise<RouteMediaInfo> {
  assertRemoteApiBase('上传路线视频');
  const token = uni.getStorageSync(TOKEN_KEY) as string;
  const base = getApiBaseUrl();
  const url = `${base}/routes/${routeId}/media`;

  const formData: Record<string, string> = {
    scope: params.scope,
    durationSec: String(Math.min(params.durationSec, ROUTE_VIDEO_MAX_DURATION_SEC)),
  };
  if (params.dayIndex != null) formData.dayIndex = String(params.dayIndex);
  if (params.attractionId != null) formData.attractionId = String(params.attractionId);
  if (params.poiName) formData.poiName = params.poiName;

  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url,
      filePath,
      name: 'file',
      formData,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const body = JSON.parse(res.data as string) as {
            code: number;
            message: string;
            data: RouteMediaInfo;
          };
          if (body.code === 0) {
            resolve(body.data);
            return;
          }
          reject(new Error(body.message || mobileT('common.uploadFailed')));
        } catch {
          reject(new Error(mobileT('common.invalidResponse')));
        }
      },
      fail: (err) =>
        reject(new Error(resolveClientRequestErrorMessage(err.errMsg, getApiAcceptLanguage()))),
    });
  });
}
