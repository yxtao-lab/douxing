import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  JourneyAlbumStatus,
  TravelPhotoSource,
  type CreateJourneyAlbumRequest,
  type JourneyAlbumDetail,
  type JourneyAlbumPhotoGroup,
  type JourneyAlbumSummary,
  type TravelPhotoInfo,
  type UpdateTravelPhotoRequest,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { journeyAlbums, travelPhotos, travelRoutes } from '../db/schema/index.js';
import type { JourneyAlbum, TravelPhoto } from '../db/schema/journey-albums.js';
import { readImageDimensions } from '../utils/image-dimensions.util.js';
import {
  deleteStoredTravelPhoto,
  persistTravelPhotoBuffer,
} from './travel-photo-storage.service.js';

export interface ResolvePhotoUrlsOptions {
  publicBase?: string;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function decimalToNumber(value: string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function groupPhotos(photos: TravelPhotoInfo[]): JourneyAlbumPhotoGroup[] {
  const map = new Map<string, JourneyAlbumPhotoGroup>();

  for (const photo of photos) {
    const key = `${photo.dayIndex ?? 'null'}::${photo.poiName ?? 'null'}::${photo.attractionId ?? 'null'}`;
    let group = map.get(key);
    if (!group) {
      group = {
        dayIndex: photo.dayIndex,
        poiName: photo.poiName,
        attractionId: photo.attractionId,
        photos: [],
      };
      map.set(key, group);
    }
    group.photos.push(photo);
  }

  const groups = Array.from(map.values());
  groups.sort((a, b) => {
    const dayA = a.dayIndex ?? -1;
    const dayB = b.dayIndex ?? -1;
    if (dayA !== dayB) return dayA - dayB;
    const poiA = a.poiName ?? '';
    const poiB = b.poiName ?? '';
    return poiA.localeCompare(poiB, 'zh-CN');
  });

  for (const group of groups) {
    group.photos.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.id - b.id;
    });
  }

  return groups;
}

function toTravelPhotoInfo(row: TravelPhoto): TravelPhotoInfo {
  return {
    id: row.id,
    albumId: row.albumId,
    storedUrl: row.storedUrl,
    byteSize: row.byteSize,
    width: row.width ?? null,
    height: row.height ?? null,
    dayIndex: row.dayIndex ?? null,
    poiName: row.poiName ?? null,
    attractionId: row.attractionId ?? null,
    checkInId: row.checkInId ?? null,
    takenAt: toIso(row.takenAt),
    latitude: decimalToNumber(row.latitude),
    longitude: decimalToNumber(row.longitude),
    caption: row.caption ?? null,
    sortOrder: row.sortOrder,
    source: row.source as TravelPhotoInfo['source'],
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  };
}

async function getOwnedRouteRow(routeId: number, userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(travelRoutes)
    .where(and(eq(travelRoutes.id, routeId), eq(travelRoutes.creatorId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

async function getAlbumRowForUser(albumId: number, userId: number): Promise<JourneyAlbum | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(journeyAlbums)
    .where(and(eq(journeyAlbums.id, albumId), eq(journeyAlbums.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

function toAlbumSummary(
  row: JourneyAlbum,
  routeName: string | null,
  coverPhotoUrl: string | null,
): JourneyAlbumSummary {
  return {
    id: row.id,
    userId: row.userId,
    routeId: row.routeId,
    routeName,
    title: row.title,
    coverPhotoId: row.coverPhotoId ?? null,
    coverPhotoUrl,
    photoCount: row.photoCount,
    bytesUsed: row.bytesUsed,
    status: row.status as JourneyAlbumSummary['status'],
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

export async function listJourneyAlbumsForUser(userId: number): Promise<JourneyAlbumSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      album: journeyAlbums,
      routeName: travelRoutes.name,
    })
    .from(journeyAlbums)
    .innerJoin(travelRoutes, eq(journeyAlbums.routeId, travelRoutes.id))
    .where(eq(journeyAlbums.userId, userId))
    .orderBy(desc(journeyAlbums.updatedAt));

  const coverIds = rows
    .map((row) => row.album.coverPhotoId)
    .filter((id): id is number => id != null);

  let coverUrlById = new Map<number, string>();
  if (coverIds.length > 0) {
    const coverRows = await db
      .select({ id: travelPhotos.id, storedUrl: travelPhotos.storedUrl })
      .from(travelPhotos)
      .where(inArray(travelPhotos.id, coverIds));
    coverUrlById = new Map(coverRows.map((item) => [item.id, item.storedUrl]));
  }

  return rows.map((row) =>
    toAlbumSummary(
      row.album,
      row.routeName,
      row.album.coverPhotoId != null ? coverUrlById.get(row.album.coverPhotoId) ?? null : null,
    ),
  );
}

export async function getJourneyAlbumDetail(
  albumId: number,
  userId: number,
): Promise<JourneyAlbumDetail | null> {
  const db = getDb();
  const album = await getAlbumRowForUser(albumId, userId);
  if (!album) return null;

  const routeRows = await db
    .select({ name: travelRoutes.name })
    .from(travelRoutes)
    .where(eq(travelRoutes.id, album.routeId))
    .limit(1);
  const routeName = routeRows[0]?.name ?? null;

  const photoRows = await db
    .select()
    .from(travelPhotos)
    .where(eq(travelPhotos.albumId, albumId))
    .orderBy(travelPhotos.dayIndex, travelPhotos.poiName, travelPhotos.sortOrder, travelPhotos.id);

  const photos = photoRows.map(toTravelPhotoInfo);
  const coverPhotoUrl =
    album.coverPhotoId != null
      ? photos.find((item) => item.id === album.coverPhotoId)?.storedUrl ?? null
      : null;

  return {
    ...toAlbumSummary(album, routeName, coverPhotoUrl),
    photos,
    groups: groupPhotos(photos),
  };
}

export async function createJourneyAlbum(
  userId: number,
  input: CreateJourneyAlbumRequest,
): Promise<JourneyAlbumSummary> {
  const route = await getOwnedRouteRow(input.routeId, userId);
  if (!route) {
    throw new ApiError(ApiMessageKey.JOURNEY_ALBUM_ROUTE_NOT_OWNED);
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(journeyAlbums)
    .where(and(eq(journeyAlbums.userId, userId), eq(journeyAlbums.routeId, input.routeId)))
    .limit(1);

  if (existing[0]) {
    return toAlbumSummary(existing[0], route.name, null);
  }

  const title = input.title?.trim() || route.name;
  const [insertResult] = await db.insert(journeyAlbums).values({
    userId,
    routeId: input.routeId,
    title,
    status: JourneyAlbumStatus.ACTIVE,
  });

  const albumId = Number(insertResult.insertId);
  const rows = await db.select().from(journeyAlbums).where(eq(journeyAlbums.id, albumId)).limit(1);
  const album = rows[0];
  if (!album) {
    throw new ApiError(ApiMessageKey.JOURNEY_ALBUM_CREATE_FAILED);
  }

  return toAlbumSummary(album, route.name, null);
}

export async function getJourneyAlbumByRoute(
  userId: number,
  routeId: number,
): Promise<JourneyAlbumSummary | null> {
  const db = getDb();
  const rows = await db
    .select({
      album: journeyAlbums,
      routeName: travelRoutes.name,
    })
    .from(journeyAlbums)
    .innerJoin(travelRoutes, eq(journeyAlbums.routeId, travelRoutes.id))
    .where(and(eq(journeyAlbums.userId, userId), eq(journeyAlbums.routeId, routeId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  let coverPhotoUrl: string | null = null;
  if (row.album.coverPhotoId != null) {
    const coverRows = await db
      .select({ storedUrl: travelPhotos.storedUrl })
      .from(travelPhotos)
      .where(eq(travelPhotos.id, row.album.coverPhotoId))
      .limit(1);
    coverPhotoUrl = coverRows[0]?.storedUrl ?? null;
  }

  return toAlbumSummary(row.album, row.routeName, coverPhotoUrl);
}

export interface UploadTravelPhotoInput {
  buffer: Buffer;
  contentType: string;
  byteSize: number;
  dayIndex?: number | null;
  poiName?: string | null;
  attractionId?: number | null;
  caption?: string | null;
  sortOrder?: number;
}

export async function uploadTravelPhoto(
  albumId: number,
  userId: number,
  input: UploadTravelPhotoInput,
): Promise<TravelPhotoInfo> {
  const album = await getAlbumRowForUser(albumId, userId);
  if (!album) {
    throw new ApiError(ApiMessageKey.JOURNEY_ALBUM_NOT_FOUND);
  }

  const { storedUrl } = await persistTravelPhotoBuffer(userId, input.buffer, input.contentType);
  const dimensions = readImageDimensions(input.buffer);

  const db = getDb();
  const [insertResult] = await db.insert(travelPhotos).values({
    userId,
    albumId,
    storedUrl,
    byteSize: input.byteSize,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    dayIndex: input.dayIndex ?? null,
    poiName: input.poiName?.trim() || null,
    attractionId: input.attractionId ?? null,
    caption: input.caption?.trim() || null,
    sortOrder: input.sortOrder ?? 0,
    source: TravelPhotoSource.UPLOAD,
  });

  const photoId = Number(insertResult.insertId);

  const albumPatch: Partial<typeof journeyAlbums.$inferInsert> = {
    photoCount: album.photoCount + 1,
    bytesUsed: album.bytesUsed + input.byteSize,
  };
  if (album.coverPhotoId == null) {
    albumPatch.coverPhotoId = photoId;
  }

  await db.update(journeyAlbums).set(albumPatch).where(eq(journeyAlbums.id, albumId));

  const rows = await db.select().from(travelPhotos).where(eq(travelPhotos.id, photoId)).limit(1);
  const photo = rows[0];
  if (!photo) {
    throw new ApiError(ApiMessageKey.TRAVEL_PHOTO_UPLOAD_FAILED);
  }

  return toTravelPhotoInfo(photo);
}

export async function updateTravelPhoto(
  albumId: number,
  photoId: number,
  userId: number,
  input: UpdateTravelPhotoRequest,
): Promise<TravelPhotoInfo | null> {
  const album = await getAlbumRowForUser(albumId, userId);
  if (!album) return null;

  const db = getDb();
  const rows = await db
    .select()
    .from(travelPhotos)
    .where(
      and(
        eq(travelPhotos.id, photoId),
        eq(travelPhotos.albumId, albumId),
        eq(travelPhotos.userId, userId),
      ),
    )
    .limit(1);

  const photo = rows[0];
  if (!photo) return null;

  const patch: Partial<typeof travelPhotos.$inferInsert> = {};
  if ('dayIndex' in input) patch.dayIndex = input.dayIndex ?? null;
  if ('poiName' in input) patch.poiName = input.poiName?.trim() || null;
  if ('attractionId' in input) patch.attractionId = input.attractionId ?? null;
  if ('caption' in input) patch.caption = input.caption?.trim() || null;
  if (input.sortOrder != null) patch.sortOrder = input.sortOrder;

  if (Object.keys(patch).length === 0) {
    return toTravelPhotoInfo(photo);
  }

  await db.update(travelPhotos).set(patch).where(eq(travelPhotos.id, photoId));

  const updatedRows = await db.select().from(travelPhotos).where(eq(travelPhotos.id, photoId)).limit(1);
  return updatedRows[0] ? toTravelPhotoInfo(updatedRows[0]) : null;
}

export async function deleteTravelPhoto(
  albumId: number,
  photoId: number,
  userId: number,
): Promise<boolean> {
  const album = await getAlbumRowForUser(albumId, userId);
  if (!album) return false;

  const db = getDb();
  const rows = await db
    .select()
    .from(travelPhotos)
    .where(
      and(
        eq(travelPhotos.id, photoId),
        eq(travelPhotos.albumId, albumId),
        eq(travelPhotos.userId, userId),
      ),
    )
    .limit(1);

  const photo = rows[0];
  if (!photo) return false;

  await deleteStoredTravelPhoto(photo.storedUrl);
  await db.delete(travelPhotos).where(eq(travelPhotos.id, photoId));

  const nextCoverId = album.coverPhotoId === photoId ? null : album.coverPhotoId;
  await db
    .update(journeyAlbums)
    .set({
      photoCount: sql`GREATEST(${journeyAlbums.photoCount} - 1, 0)`,
      bytesUsed: sql`GREATEST(${journeyAlbums.bytesUsed} - ${photo.byteSize}, 0)`,
      coverPhotoId: nextCoverId,
    })
    .where(eq(journeyAlbums.id, albumId));

  if (album.coverPhotoId === photoId) {
    const remaining = await db
      .select({ id: travelPhotos.id })
      .from(travelPhotos)
      .where(eq(travelPhotos.albumId, albumId))
      .orderBy(travelPhotos.id)
      .limit(1);
    if (remaining[0]) {
      await db
        .update(journeyAlbums)
        .set({ coverPhotoId: remaining[0].id })
        .where(eq(journeyAlbums.id, albumId));
    }
  }

  return true;
}

export function resolveAlbumPhotoUrls<T extends { storedUrl: string }>(
  photos: T[],
  resolveUrl: (stored: string) => string | null,
): T[] {
  return photos.map((photo) => ({
    ...photo,
    storedUrl: resolveUrl(photo.storedUrl) ?? photo.storedUrl,
  }));
}

export function resolveAlbumSummaryUrls(
  album: JourneyAlbumSummary,
  resolveUrl: (stored: string | null) => string | null,
): JourneyAlbumSummary {
  return {
    ...album,
    coverPhotoUrl: album.coverPhotoUrl ? resolveUrl(album.coverPhotoUrl) : null,
  };
}

export function resolveAlbumDetailUrls(
  detail: JourneyAlbumDetail,
  resolveUrl: (stored: string) => string | null,
): JourneyAlbumDetail {
  const photos = resolveAlbumPhotoUrls(detail.photos, resolveUrl);
  return {
    ...resolveAlbumSummaryUrls(detail, (stored) => (stored ? resolveUrl(stored) : null)),
    photos,
    groups: detail.groups.map((group) => ({
      ...group,
      photos: resolveAlbumPhotoUrls(group.photos, resolveUrl),
    })),
  };
}
