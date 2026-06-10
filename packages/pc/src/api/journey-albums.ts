import http from './http';
import type {
  ApiResponse,
  ApplyExifSuggestionsResult,
  JourneyAlbumDetail,
  JourneyAlbumPhotoGroup,
  JourneyAlbumShareState,
  JourneyAlbumSummary,
  PaginatedResult,
  SharedJourneyAlbumPayload,
  TravelPhotoInfo,
  UpdateTravelPhotoRequest,
  UserPhotoStorageInfo,
  UserTravelPhotoListItem,
} from '@douxing/shared';

export async function fetchJourneyAlbumByRoute(routeId: number) {
  const { data } = await http.get<ApiResponse<JourneyAlbumDetail>>(
    `/journey-albums/by-route/${routeId}`,
  );
  return data.data;
}

export async function fetchTravelPhotosPage(params: { page: number; pageSize: number }) {
  const { data } = await http.get<ApiResponse<PaginatedResult<UserTravelPhotoListItem>>>(
    `/journey-albums/photos?page=${params.page}&pageSize=${params.pageSize}`,
  );
  return data.data;
}

export async function createJourneyAlbum(routeId: number, title?: string) {
  const { data } = await http.post<ApiResponse<JourneyAlbumSummary>>('/journey-albums', {
    routeId,
    title,
  });
  return data.data;
}

export async function updateTravelPhotoMeta(
  albumId: number,
  photoId: number,
  body: UpdateTravelPhotoRequest,
) {
  const { data } = await http.patch<ApiResponse<TravelPhotoInfo>>(
    `/journey-albums/${albumId}/photos/${photoId}`,
    body,
  );
  return data.data;
}

export async function deleteTravelPhoto(albumId: number, photoId: number) {
  const { data } = await http.delete<ApiResponse<{ photoId: number }>>(
    `/journey-albums/${albumId}/photos/${photoId}`,
  );
  return data.data;
}

export async function fetchPhotoStorage() {
  const { data } = await http.get<ApiResponse<UserPhotoStorageInfo>>('/users/me/storage');
  return data.data;
}

export async function updateJourneyAlbumShare(albumId: number, enabled: boolean) {
  const { data } = await http.post<ApiResponse<JourneyAlbumShareState>>(
    `/journey-albums/${albumId}/share`,
    { enabled },
  );
  return data.data;
}

export async function applyExifSuggestions(albumId: number, photoIds?: number[]) {
  const { data } = await http.post<ApiResponse<ApplyExifSuggestionsResult>>(
    `/journey-albums/${albumId}/photos/apply-exif-suggestions`,
    photoIds ? { photoIds } : {},
  );
  return data.data;
}

export async function fetchSharedJourneyAlbum(token: string) {
  const { data } = await http.get<ApiResponse<SharedJourneyAlbumPayload>>(
    `/share/journey-albums/${encodeURIComponent(token)}`,
  );
  return data.data;
}

export async function uploadJourneyAlbumPhoto(
  albumId: number,
  file: File,
  meta?: {
    dayIndex?: number | null;
    poiName?: string | null;
    attractionId?: number | null;
    caption?: string | null;
  },
) {
  const formData = new FormData();
  formData.append('file', file);
  if (meta?.dayIndex != null) formData.append('dayIndex', String(meta.dayIndex));
  if (meta?.poiName) formData.append('poiName', meta.poiName);
  if (meta?.attractionId != null) formData.append('attractionId', String(meta.attractionId));
  if (meta?.caption) formData.append('caption', meta.caption);

  const { data } = await http.post<ApiResponse<TravelPhotoInfo>>(
    `/journey-albums/${albumId}/photos`,
    formData,
  );
  return data.data;
}

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
