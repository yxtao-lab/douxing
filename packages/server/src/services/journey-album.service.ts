import { and, desc, eq, inArray, sql, count } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ApiError,
  ApiMessageKey,
  JourneyAlbumStatus,
  TravelPhotoSource,
  type CreateJourneyAlbumRequest,
  type JourneyAlbumDetail,
  type JourneyAlbumPhotoGroup,
  type JourneyAlbumSummary,
  type RouteDayPlan,
  type RouteDetailPayload,
  type TravelPhotoInfo,
  type UpdateTravelPhotoRequest,
  type UserTravelPhotoListItem,
  buildPaginatedResult,
  type PaginatedResult,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { journeyAlbums, travelPhotos, travelRoutes } from '../db/schema/index.js';
import type { JourneyAlbum, TravelPhoto } from '../db/schema/journey-albums.js';
import { readImageDimensions } from '../utils/image-dimensions.util.js';
import { normalizeStoredAssetPath } from '../utils/public-asset-url.util.js';
import {
  deleteStoredTravelPhoto,
  persistTravelPhotoBuffer,
} from './travel-photo-storage.service.js';
import { assertCanUploadTravelPhoto } from './photo-quota.service.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const checkInPhotosRoot = path.resolve(serverRoot, 'uploads/checkins');

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

function resolveStoredPhotoByteSize(storedUrl: string): number {
  const relative = normalizeStoredAssetPath(storedUrl);
  if (!relative) return 0;

  const checkInMatch = relative.match(/^\/uploads\/checkins\/([^/]+)$/i);
  if (checkInMatch?.[1] && !checkInMatch[1].includes('..')) {
    const abs = path.resolve(checkInPhotosRoot, checkInMatch[1]);
    if (abs.startsWith(`${checkInPhotosRoot}${path.sep}`) && fs.existsSync(abs)) {
      return fs.statSync(abs).size;
    }
  }

  const photoMatch = relative.match(/^\/uploads\/photos\/(\d+)\/([^/]+)$/i);
  if (photoMatch?.[1] && photoMatch[2] && !photoMatch[2].includes('..')) {
    const abs = path.resolve(serverRoot, 'uploads/photos', photoMatch[1], photoMatch[2]);
    const base = path.resolve(serverRoot, 'uploads/photos', photoMatch[1]);
    if (abs.startsWith(`${base}${path.sep}`) && fs.existsSync(abs)) {
      return fs.statSync(abs).size;
    }
  }

  return 512 * 1024;
}

export interface ResolvedRoutePoi {
  dayIndex: number | null;
  poiName: string | null;
  attractionId: number | null;
}

export function resolvePoiFromRouteDetail(
  routeDetail: RouteDetailPayload | Record<string, unknown> | null | undefined,
  options: { attractionId?: number | null; placeName?: string | null },
): ResolvedRoutePoi {
  const detail = routeDetail as RouteDetailPayload | null | undefined;
  const days = detail?.days ?? [];

  if (options.attractionId != null) {
    for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
      const day = days[dayIndex] as RouteDayPlan;
      const spot = day.attractions?.find((item) => item.attractionId === options.attractionId);
      if (spot) {
        return {
          dayIndex,
          poiName: spot.name,
          attractionId: spot.attractionId ?? options.attractionId,
        };
      }
    }
  }

  const placeName = options.placeName?.trim();
  if (placeName) {
    for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
      const day = days[dayIndex] as RouteDayPlan;
      const spot = day.attractions?.find((item) => item.name.trim() === placeName);
      if (spot) {
        return {
          dayIndex,
          poiName: spot.name,
          attractionId: spot.attractionId ?? null,
        };
      }
    }
  }

  return {
    dayIndex: null,
    poiName: placeName ?? null,
    attractionId: options.attractionId ?? null,
  };
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

/** 用户全站旅行照片（分页，按上传时间倒序） */
export async function listUserTravelPhotosPaginated(
  userId: number,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<UserTravelPhotoListItem>> {
  const db = getDb();
  const where = eq(travelPhotos.userId, userId);
  const [{ value: total }] = await db.select({ value: count() }).from(travelPhotos).where(where);
  const offset = (page - 1) * pageSize;

  const rows = await db
    .select({
      photo: travelPhotos,
      albumTitle: journeyAlbums.title,
      routeId: journeyAlbums.routeId,
      routeName: travelRoutes.name,
    })
    .from(travelPhotos)
    .innerJoin(journeyAlbums, eq(travelPhotos.albumId, journeyAlbums.id))
    .innerJoin(travelRoutes, eq(journeyAlbums.routeId, travelRoutes.id))
    .where(where)
    .orderBy(desc(travelPhotos.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items: UserTravelPhotoListItem[] = rows.map((row) => ({
    ...toTravelPhotoInfo(row.photo),
    albumTitle: row.albumTitle,
    routeId: row.routeId,
    routeName: row.routeName,
  }));

  return buildPaginatedResult(items, Number(total ?? 0), page, pageSize);
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

  await assertCanUploadTravelPhoto(userId, input.byteSize);

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

export interface IngestCheckInPhotosInput {
  userId: number;
  routeId: number;
  checkInId: number;
  photos: string[];
  attractionId?: number | null;
  placeName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** 将打卡照片归并进旅程相册（J4） */
export async function ingestCheckInPhotosToAlbum(input: IngestCheckInPhotosInput): Promise<void> {
  const normalizedPhotos = input.photos
    .map((item) => normalizeStoredAssetPath(item))
    .filter((item): item is string => Boolean(item));

  if (normalizedPhotos.length === 0) return;

  const route = await getOwnedRouteRow(input.routeId, input.userId);
  if (!route) return;

  const albumSummary = await createJourneyAlbum(input.userId, { routeId: input.routeId });
  const poi = resolvePoiFromRouteDetail(route.routeDetail as RouteDetailPayload | null, {
    attractionId: input.attractionId,
    placeName: input.placeName,
  });

  const db = getDb();
  const album = await getAlbumRowForUser(albumSummary.id, input.userId);
  if (!album) return;

  const photoSizes = normalizedPhotos.map((storedUrl) => resolveStoredPhotoByteSize(storedUrl));
  const totalBytes = photoSizes.reduce((sum, size) => sum + size, 0);
  const maxSingle = Math.max(...photoSizes, 0);
  await assertCanUploadTravelPhoto(input.userId, maxSingle, {
    additionalCount: normalizedPhotos.length - 1,
    additionalBytes: totalBytes - maxSingle,
  });

  let photoCount = album.photoCount;
  let bytesUsed = album.bytesUsed;
  let coverPhotoId = album.coverPhotoId;

  for (let index = 0; index < normalizedPhotos.length; index += 1) {
    const storedUrl = normalizedPhotos[index]!;
    const byteSize = photoSizes[index] ?? 0;

    const [insertResult] = await db.insert(travelPhotos).values({
      userId: input.userId,
      albumId: album.id,
      storedUrl,
      byteSize,
      dayIndex: poi.dayIndex,
      poiName: poi.poiName,
      attractionId: poi.attractionId,
      checkInId: input.checkInId,
      latitude: input.latitude != null ? String(input.latitude) : null,
      longitude: input.longitude != null ? String(input.longitude) : null,
      sortOrder: index,
      source: TravelPhotoSource.CHECKIN,
    });

    const photoId = Number(insertResult.insertId);
    photoCount += 1;
    bytesUsed += byteSize;
    if (coverPhotoId == null) {
      coverPhotoId = photoId;
    }
  }

  await db
    .update(journeyAlbums)
    .set({ photoCount, bytesUsed, coverPhotoId })
    .where(eq(journeyAlbums.id, album.id));
}

/** 按打卡 ID 批量取相册照片 URL（优先于 check_ins.photos） */
export async function getAlbumPhotoUrlsByCheckInIds(
  checkInIds: number[],
): Promise<Map<number, string[]>> {
  if (checkInIds.length === 0) return new Map();

  const db = getDb();
  const rows = await db
    .select({
      checkInId: travelPhotos.checkInId,
      storedUrl: travelPhotos.storedUrl,
      sortOrder: travelPhotos.sortOrder,
      id: travelPhotos.id,
    })
    .from(travelPhotos)
    .where(inArray(travelPhotos.checkInId, checkInIds))
    .orderBy(travelPhotos.checkInId, travelPhotos.sortOrder, travelPhotos.id);

  const map = new Map<number, string[]>();
  for (const row of rows) {
    if (row.checkInId == null) continue;
    const list = map.get(row.checkInId) ?? [];
    list.push(row.storedUrl);
    map.set(row.checkInId, list);
  }
  return map;
}

/** 路线相册按天聚合的高亮图 URL（供手帐 poster 使用） */
export async function getJourneyHighlightImagesByDay(
  userId: number,
  routeId: number,
): Promise<string[][]> {
  const db = getDb();
  const albumRows = await db
    .select({ id: journeyAlbums.id })
    .from(journeyAlbums)
    .where(and(eq(journeyAlbums.userId, userId), eq(journeyAlbums.routeId, routeId)))
    .limit(1);

  const albumId = albumRows[0]?.id;
  if (!albumId) return [];

  const routeRows = await db
    .select({ routeDetail: travelRoutes.routeDetail, days: travelRoutes.days })
    .from(travelRoutes)
    .where(eq(travelRoutes.id, routeId))
    .limit(1);
  const dayCount = routeRows[0]?.days ?? 0;

  const photoRows = await db
    .select({
      dayIndex: travelPhotos.dayIndex,
      storedUrl: travelPhotos.storedUrl,
      sortOrder: travelPhotos.sortOrder,
      id: travelPhotos.id,
    })
    .from(travelPhotos)
    .where(eq(travelPhotos.albumId, albumId))
    .orderBy(travelPhotos.dayIndex, travelPhotos.sortOrder, travelPhotos.id);

  const buckets: string[][] = Array.from({ length: Math.max(dayCount, 1) }, () => []);
  for (const row of photoRows) {
    const dayIndex = row.dayIndex ?? 0;
    while (buckets.length <= dayIndex) buckets.push([]);
    buckets[dayIndex]!.push(row.storedUrl);
  }
  return buckets;
}

/** 按 POI 名称取相册封面图（attractionId 优先） */
export async function getJourneyPhotoUrlByPoi(
  userId: number,
  routeId: number,
  poiName: string,
  attractionId?: number | null,
): Promise<string | null> {
  const db = getDb();
  const albumRows = await db
    .select({ id: journeyAlbums.id })
    .from(journeyAlbums)
    .where(and(eq(journeyAlbums.userId, userId), eq(journeyAlbums.routeId, routeId)))
    .limit(1);
  const albumId = albumRows[0]?.id;
  if (!albumId) return null;

  const conditions = [eq(travelPhotos.albumId, albumId)];
  if (attractionId != null) {
    conditions.push(eq(travelPhotos.attractionId, attractionId));
  } else {
    conditions.push(eq(travelPhotos.poiName, poiName));
  }

  const rows = await db
    .select({ storedUrl: travelPhotos.storedUrl })
    .from(travelPhotos)
    .where(and(...conditions))
    .orderBy(travelPhotos.sortOrder, travelPhotos.id)
    .limit(1);

  return rows[0]?.storedUrl ?? null;
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
