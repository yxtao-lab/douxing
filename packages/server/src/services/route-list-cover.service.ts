import { and, asc, eq, inArray } from 'drizzle-orm';
import type { RouteDetailPayload, TravelRouteInfo } from '@douxing/shared';
import { pickRouteCoverFromDetail } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { journeyAlbums, travelPhotos, travelRoutes } from '../db/schema/index.js';
import {
  extractAttractionIdsFromRouteDetail,
  getAttractionsByIdsForRouteMedia,
} from './attraction.service.js';

async function getAlbumCoverUrlsByRouteIds(routeIds: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (routeIds.length === 0) return result;

  const db = getDb();
  const rows = await db
    .select({
      routeId: journeyAlbums.routeId,
      albumId: journeyAlbums.id,
      coverPhotoId: journeyAlbums.coverPhotoId,
      photoCount: journeyAlbums.photoCount,
    })
    .from(journeyAlbums)
    .innerJoin(
      travelRoutes,
      and(eq(journeyAlbums.routeId, travelRoutes.id), eq(journeyAlbums.userId, travelRoutes.creatorId)),
    )
    .where(inArray(journeyAlbums.routeId, routeIds));

  const coverPhotoIds = rows
    .map((row) => row.coverPhotoId)
    .filter((id): id is number => id != null);

  const coverUrlByPhotoId = new Map<number, string>();
  if (coverPhotoIds.length > 0) {
    const coverRows = await db
      .select({ id: travelPhotos.id, storedUrl: travelPhotos.storedUrl })
      .from(travelPhotos)
      .where(inArray(travelPhotos.id, coverPhotoIds));
    for (const row of coverRows) {
      coverUrlByPhotoId.set(row.id, row.storedUrl);
    }
  }

  for (const row of rows) {
    if (row.coverPhotoId != null) {
      const url = coverUrlByPhotoId.get(row.coverPhotoId);
      if (url) result.set(row.routeId, url);
    }
  }

  const albumsNeedingFirstPhoto = rows.filter(
    (row) => !result.has(row.routeId) && row.photoCount > 0,
  );
  if (albumsNeedingFirstPhoto.length === 0) return result;

  const albumIds = albumsNeedingFirstPhoto.map((row) => row.albumId);
  const photoRows = await db
    .select({
      albumId: travelPhotos.albumId,
      storedUrl: travelPhotos.storedUrl,
    })
    .from(travelPhotos)
    .where(inArray(travelPhotos.albumId, albumIds))
    .orderBy(asc(travelPhotos.sortOrder), asc(travelPhotos.id));

  const firstPhotoByAlbum = new Map<number, string>();
  for (const photo of photoRows) {
    if (!firstPhotoByAlbum.has(photo.albumId)) {
      firstPhotoByAlbum.set(photo.albumId, photo.storedUrl);
    }
  }

  for (const row of albumsNeedingFirstPhoto) {
    const url = firstPhotoByAlbum.get(row.albumId);
    if (url) result.set(row.routeId, url);
  }

  return result;
}

function pickAttractionCoverForRoute(
  routeDetail: Record<string, unknown> | null,
  coverByAttractionId: Map<number, string>,
): string | null {
  if (!routeDetail || coverByAttractionId.size === 0) return null;
  const days = (routeDetail as unknown as RouteDetailPayload).days;
  if (!Array.isArray(days)) return null;

  for (const day of days) {
    if (!day?.attractions?.length) continue;
    for (const spot of day.attractions) {
      if (spot.attractionId == null) continue;
      const url = coverByAttractionId.get(spot.attractionId);
      if (url) return url;
    }
  }
  return null;
}

/** 为路线列表批量填充 listCoverImageUrl */
export async function enrichRoutesWithListCoverImages(
  routes: TravelRouteInfo[],
  resolveUrl: (stored: string) => string,
): Promise<TravelRouteInfo[]> {
  if (routes.length === 0) return routes;

  const routeIds = routes.map((route) => route.id);
  const albumCoverByRoute = await getAlbumCoverUrlsByRouteIds(routeIds);

  const routesMissingAlbum = routes.filter((route) => !albumCoverByRoute.has(route.id));
  const allAttractionIds = [
    ...new Set(
      routesMissingAlbum.flatMap((route) =>
        extractAttractionIdsFromRouteDetail(route.routeDetail as RouteDetailPayload | null),
      ),
    ),
  ];

  const coverByAttractionId = new Map<number, string>();
  if (allAttractionIds.length > 0) {
    const attractions = await getAttractionsByIdsForRouteMedia(allAttractionIds);
    for (const item of attractions) {
      if (item.coverImageUrl) {
        coverByAttractionId.set(item.id, item.coverImageUrl);
      }
    }
  }

  return routes.map((route) => {
    const albumStored = albumCoverByRoute.get(route.id);
    const attractionStored = pickAttractionCoverForRoute(route.routeDetail, coverByAttractionId);
    const inlineStored = pickRouteCoverFromDetail(route.routeDetail);
    const raw = albumStored ?? attractionStored ?? inlineStored ?? null;
    const listCoverImageUrl = raw
      ? raw.startsWith('http://') || raw.startsWith('https://')
        ? raw
        : resolveUrl(raw)
      : null;
    return { ...route, listCoverImageUrl };
  });
}
