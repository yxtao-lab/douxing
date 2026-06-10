import type {
  JourneyAlbumDetail,
  JourneyAlbumPhotoGroup,
  JourneyAlbumSummary,
  PaginatedResult,
  TravelPhotoInfo,
  UpdateTravelPhotoRequest,
  UserPhotoStorageInfo,
  UserTravelPhotoListItem,
} from '@douxing/shared';
import { request } from '@/utils/request';
import { getApiBaseUrl, assertRemoteApiBase } from '@/utils/api-base';
import { resolveClientRequestErrorMessage } from '@douxing/shared';
import { getApiAcceptLanguage } from '@/utils/api-locale-header';
import { mobileT } from '@/i18n/mobileT';

const TOKEN_KEY = 'douxing_token';

export function fetchJourneyAlbumByRoute(routeId: number) {
  return request<JourneyAlbumDetail>(`/journey-albums/by-route/${routeId}`);
}

export function fetchTravelPhotosPage(params: { page: number; pageSize: number }) {
  return request<PaginatedResult<UserTravelPhotoListItem>>(
    `/journey-albums/photos?page=${params.page}&pageSize=${params.pageSize}`,
  );
}

export function createJourneyAlbum(routeId: number, title?: string) {
  return request<JourneyAlbumSummary>('/journey-albums', {
    method: 'POST',
    data: { routeId, title },
  });
}

export function updateTravelPhotoMeta(
  albumId: number,
  photoId: number,
  data: UpdateTravelPhotoRequest,
) {
  return request<TravelPhotoInfo>(`/journey-albums/${albumId}/photos/${photoId}`, {
    method: 'PATCH',
    data,
  });
}

export function deleteTravelPhoto(albumId: number, photoId: number) {
  return request<{ photoId: number }>(`/journey-albums/${albumId}/photos/${photoId}`, {
    method: 'DELETE',
  });
}

export function fetchPhotoStorage() {
  return request<UserPhotoStorageInfo>('/users/me/storage');
}

export function uploadJourneyAlbumPhoto(
  albumId: number,
  filePath: string,
  meta?: {
    dayIndex?: number | null;
    poiName?: string | null;
    attractionId?: number | null;
    caption?: string | null;
  },
): Promise<TravelPhotoInfo> {
  assertRemoteApiBase('上传旅程照片');
  const token = uni.getStorageSync(TOKEN_KEY) as string;
  const base = getApiBaseUrl();
  const url = `${base}/journey-albums/${albumId}/photos`;

  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url,
      filePath,
      name: 'file',
      formData: {
        dayIndex: meta?.dayIndex != null ? String(meta.dayIndex) : '',
        poiName: meta?.poiName ?? '',
        attractionId: meta?.attractionId != null ? String(meta.attractionId) : '',
        caption: meta?.caption ?? '',
      },
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const body = JSON.parse(res.data as string) as {
            code: number;
            message: string;
            data: TravelPhotoInfo;
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

/** 从相册详情构建手帐 poster 所需的旅程图映射 */
export function buildJourneyPosterMaps(detail: JourneyAlbumDetail | null | undefined): {
  journeyHighlightByDay: string[][];
  journeyPhotoByPoiKey: Record<string, string>;
} {
  const journeyHighlightByDay: string[][] = [];
  const journeyPhotoByPoiKey: Record<string, string> = {};

  if (!detail) {
    return { journeyHighlightByDay, journeyPhotoByPoiKey };
  }

  const appendGroup = (group: JourneyAlbumPhotoGroup) => {
    const dayIndex = group.dayIndex ?? 0;
    while (journeyHighlightByDay.length <= dayIndex) {
      journeyHighlightByDay.push([]);
    }
    for (const photo of group.photos) {
      journeyHighlightByDay[dayIndex]!.push(photo.storedUrl);
      if (group.poiName) {
        const key =
          group.attractionId != null
            ? `a:${group.attractionId}`
            : `d:${dayIndex}::${group.poiName}`;
        if (!journeyPhotoByPoiKey[key]) {
          journeyPhotoByPoiKey[key] = photo.storedUrl;
        }
      }
    }
  };

  for (const group of detail.groups) {
    appendGroup(group);
  }

  return { journeyHighlightByDay, journeyPhotoByPoiKey };
}

/** 未分配照片（dayIndex 与 poiName 均为空） */
export function getUnassignedPhotos(detail: JourneyAlbumDetail | null | undefined): TravelPhotoInfo[] {
  if (!detail) return [];
  return detail.photos.filter((photo) => photo.dayIndex == null && !photo.poiName?.trim());
}

export function formatStorageBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}
