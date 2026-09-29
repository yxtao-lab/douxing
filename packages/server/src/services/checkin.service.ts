import { eq, desc, and, inArray, sql, count, gte, lte, or, like } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { checkIns, type CheckInLocation } from '../db/schema/check-ins.js';
import { attractions } from '../db/schema/attractions.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import {
  CheckInStatus,
  CHECKIN_MAX_PHOTOS,
  computeCheckInVerificationAward,
  extractRouteKeyAttractionIds,
} from '@douxing/shared';
import type { CheckInInfo, CheckInTimeRange, PaginatedResult } from '@douxing/shared';
import { buildPaginatedResult } from '@douxing/shared';
import { evaluateAchievements } from './achievement.service.js';
import { evaluateBadges } from './badge.service.js';
import { grantPetExpOnCheckIn } from './pet-exp.service.js';
import type { LocaleCode } from '@douxing/shared';
import { getAttractionForCheckIn } from './attraction.service.js';
import { ingestCheckInPhotosToAlbum, getAlbumPhotoUrlsByCheckInIds } from './journey-album.service.js';
import { recomputeRouteTrustSafe } from './route-trust.service.js';
import {
  awardCheckInVerification,
  hasCheckInVerificationForPoi,
  maybeAwardFollowCompleteSafe,
} from './verification-points.service.js';
import {
  assertNotCheckedInToday,
  validateCheckInGeofence,
} from './checkin-geofence.service.js';
import { CheckinValidationError } from '../utils/checkin-errors.js';
import { rewritePublicAssetUrls, normalizeStoredAssetPaths } from '../utils/public-asset-url.util.js';

function toCheckInInfo(
  row: typeof checkIns.$inferSelect,
  cityMap?: Map<string, string>,
  distanceMeters?: number | null,
): CheckInInfo {
  return {
    id: row.id,
    userId: row.userId,
    routeId: row.routeId,
    attractionId: row.attractionId ?? null,
    location: row.location,
    cityCode: row.cityCode,
    city: cityMap?.get(row.cityCode) ?? null,
    photos: rewritePublicAssetUrls(row.photos ?? []),
    pointsEarned: row.pointsEarned,
    gpsAccuracy: row.gpsAccuracy ?? null,
    distanceMeters: distanceMeters ?? null,
    checkedAt: row.checkedAt.toISOString(),
    status: row.status,
    remark: row.remark,
  };
}

async function buildCityMap(cityCodes: string[]) {
  const cityMap = new Map<string, string>();
  if (cityCodes.length === 0) return cityMap;

  const db = getDb();
  const rows = await db
    .select({ city: attractions.city, cityCode: attractions.cityCode })
    .from(attractions)
    .where(inArray(attractions.cityCode, cityCodes));

  for (const row of rows) {
    if (!cityMap.has(row.cityCode)) {
      cityMap.set(row.cityCode, row.city);
    }
  }
  return cityMap;
}

async function mapRowsToCheckInInfo(rows: typeof checkIns.$inferSelect[]) {
  const cityCodes = [...new Set(rows.map((row) => row.cityCode))];
  const cityMap = await buildCityMap(cityCodes);
  const albumPhotosByCheckInId = await getAlbumPhotoUrlsByCheckInIds(rows.map((row) => row.id));

  return rows.map((row) => {
    const albumPhotos = albumPhotosByCheckInId.get(row.id);
    const photos =
      albumPhotos && albumPhotos.length > 0
        ? rewritePublicAssetUrls(albumPhotos)
        : rewritePublicAssetUrls(row.photos ?? []);
    return {
      ...toCheckInInfo(row, cityMap),
      photos,
    };
  });
}

async function resolveCityCodeFromCityName(cityName: string) {
  const db = getDb();
  const rows = await db
    .select({ cityCode: attractions.cityCode })
    .from(attractions)
    .where(eq(attractions.city, cityName))
    .limit(1);
  return rows[0]?.cityCode ?? null;
}

async function resolveCityCode(attractionId?: number, cityCode?: string, cityName?: string) {
  if (attractionId) {
    const attraction = await getAttractionForCheckIn(attractionId);
    if (!attraction) {
      throw new CheckinValidationError('关联景点不存在或已禁用');
    }
    return attraction.cityCode;
  }
  if (cityCode?.trim()) {
    return cityCode.trim();
  }
  if (cityName?.trim()) {
    const resolved = await resolveCityCodeFromCityName(cityName.trim());
    if (resolved) return resolved;
  }
  throw new CheckinValidationError('请提供城市编码或关联景点');
}

async function isFirstCheckInAtAttraction(userId: number, attractionId?: number) {
  if (!attractionId) return false;
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), eq(checkIns.attractionId, attractionId)));
  return Number(rows[0]?.count ?? 0) === 0;
}

/**
 * 预估打卡验证分（仅用于插入前写入 points_earned；落库以后端账本为准）。
 * 同点若已入账则返回 0。
 *
 * @param hasPhotos - 是否带图
 * @param isFirstAtAttraction - 是否全局首次该景点
 * @param isKeyNode - 是否路线关键节点
 * @param alreadyAwardedForPoi - 同点是否已拿过验证分
 * @returns 预计积分
 */
function estimateCheckInPoints(
  hasPhotos: boolean,
  isFirstAtAttraction: boolean,
  isKeyNode: boolean,
  alreadyAwardedForPoi: boolean,
) {
  return computeCheckInVerificationAward({
    hasPhotos,
    isFirstAtAttraction,
    isKeyNode,
    alreadyAwardedForPoi,
  }).total;
}

export async function createCheckIn(
  userId: number,
  data: {
    routeId: number;
    location: CheckInLocation;
    attractionId?: number;
    cityCode?: string;
    cityName?: string;
    targetLatitude?: number;
    targetLongitude?: number;
    gpsAccuracy?: number;
    photos?: string[];
    remark?: string;
    addToAlbum?: boolean;
    locale?: LocaleCode;
  },
) {
  if (data.location.latitude == null || data.location.longitude == null) {
    throw new CheckinValidationError('请上报当前 GPS 位置');
  }

  await assertNotCheckedInToday(userId, data.attractionId);

  const { assertUgcRateLimit } = await import('./ugc-rate-limit.service.js');
  const { UGC_RATE_LIMITS: ugcLimits } = await import('@douxing/shared');
  await assertUgcRateLimit(
    userId,
    'checkin',
    ugcLimits.CHECKIN_PER_DAY,
    ugcLimits.CHECKIN_WINDOW_SEC,
  );

  const distanceMeters = await validateCheckInGeofence({
    userId,
    userLatitude: data.location.latitude,
    userLongitude: data.location.longitude,
    gpsAccuracy: data.gpsAccuracy,
    attractionId: data.attractionId,
    targetLatitude: data.targetLatitude,
    targetLongitude: data.targetLongitude,
  });

  const photos = normalizeStoredAssetPaths((data.photos ?? []).slice(0, CHECKIN_MAX_PHOTOS));
  const cityCode = await resolveCityCode(data.attractionId, data.cityCode, data.cityName);
  const isFirstAtAttraction = await isFirstCheckInAtAttraction(userId, data.attractionId);

  const db = getDb();
  const routeRows = await db
    .select({ routeDetail: travelRoutes.routeDetail })
    .from(travelRoutes)
    .where(eq(travelRoutes.id, data.routeId))
    .limit(1);
  const routeDetail = routeRows[0]?.routeDetail ?? null;

  const keyIds = extractRouteKeyAttractionIds(routeDetail);
  const attractionId = data.attractionId && data.attractionId > 0 ? data.attractionId : null;
  const isKeyNode = attractionId != null && keyIds.includes(attractionId);
  const alreadyAwardedForPoi = await hasCheckInVerificationForPoi(
    userId,
    data.routeId,
    attractionId,
  );
  const pointsEarned = estimateCheckInPoints(
    photos.length > 0,
    isFirstAtAttraction,
    isKeyNode,
    alreadyAwardedForPoi,
  );

  const [result] = await db.insert(checkIns).values({
    userId,
    routeId: data.routeId,
    attractionId: data.attractionId ?? null,
    location: data.location,
    cityCode,
    photos: photos.length > 0 ? photos : null,
    pointsEarned,
    gpsAccuracy: data.gpsAccuracy != null ? Math.round(data.gpsAccuracy) : null,
    remark: data.remark ?? null,
    status: CheckInStatus.APPROVED,
  });

  const id = Number(result.insertId);
  const rows = await db.select().from(checkIns).where(eq(checkIns.id, id)).limit(1);
  const cityMap = await buildCityMap([cityCode]);
  const checkIn = toCheckInInfo(rows[0]!, cityMap, distanceMeters);

  if (photos.length > 0 && data.addToAlbum !== false) {
    try {
      await ingestCheckInPhotosToAlbum({
        userId,
        routeId: data.routeId,
        checkInId: id,
        photos,
        attractionId: data.attractionId,
        placeName: data.location.placeName,
        latitude: data.location.latitude,
        longitude: data.location.longitude,
      });
    } catch (err) {
      console.error('[checkins/ingest-album]', err);
    }
  }

  const albumPhotosByCheckInId = await getAlbumPhotoUrlsByCheckInIds([id]);
  const albumPhotos = albumPhotosByCheckInId.get(id);
  let enrichedCheckIn: CheckInInfo = {
    ...checkIn,
    photos:
      albumPhotos && albumPhotos.length > 0
        ? rewritePublicAssetUrls(albumPhotos)
        : checkIn.photos,
  };

  try {
    const { creditedPoints } = await awardCheckInVerification({
      userId,
      routeId: data.routeId,
      checkInId: id,
      attractionId,
      isFirstAtAttraction,
      hasPhotos: photos.length > 0,
      routeDetail,
    });
    if (creditedPoints !== pointsEarned) {
      await db.update(checkIns).set({ pointsEarned: creditedPoints }).where(eq(checkIns.id, id));
      enrichedCheckIn = { ...enrichedCheckIn, pointsEarned: creditedPoints };
    }
  } catch (err) {
    console.warn(
      '[checkins] 验证积分入账失败',
      id,
      err instanceof Error ? err.message : err,
    );
  }

  await maybeAwardFollowCompleteSafe(data.routeId, userId);

  const newAchievements = await evaluateAchievements(userId);
  const newBadges = await evaluateBadges(userId);
  const petCelebration = await grantPetExpOnCheckIn(
    userId,
    {
      hasPhoto: photos.length > 0,
      isFirstAtAttraction,
    },
    data.locale ?? 'zh-CN',
  );
  await recomputeRouteTrustSafe(data.routeId);
  return { checkIn: enrichedCheckIn, newAchievements, newBadges, petCelebration };
}

function resolveCheckInSince(range?: CheckInTimeRange) {
  if (!range || range === 'all') return undefined;
  const daysMap = { '7d': 7, '30d': 30, '90d': 90 } as const;
  const days = daysMap[range];
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function paginateCheckIns(
  where: ReturnType<typeof and> | undefined,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<CheckInInfo>> {
  const db = getDb();
  const [{ value: total }] = await db.select({ value: count() }).from(checkIns).where(where);
  const offset = (page - 1) * pageSize;
  const rows = await db
    .select()
    .from(checkIns)
    .where(where)
    .orderBy(desc(checkIns.checkedAt))
    .limit(pageSize)
    .offset(offset);
  const items = await mapRowsToCheckInInfo(rows);
  return buildPaginatedResult(items, Number(total ?? 0), page, pageSize);
}

export async function listUserCheckInsPaginated(
  userId: number,
  page: number,
  pageSize: number,
  range?: CheckInTimeRange,
) {
  const since = resolveCheckInSince(range);
  const conditions = [eq(checkIns.userId, userId)];
  if (since) conditions.push(gte(checkIns.checkedAt, since));
  return paginateCheckIns(and(...conditions), page, pageSize);
}

export async function listRouteCheckInsPaginated(
  routeId: number,
  userId: number,
  page: number,
  pageSize: number,
) {
  return paginateCheckIns(and(eq(checkIns.routeId, routeId), eq(checkIns.userId, userId)), page, pageSize);
}

export interface AdminCheckInListFilter {
  keyword?: string;
  userId?: number;
  routeId?: number;
  cityCode?: string;
  dateStart?: string;
  dateEnd?: string;
}

function buildAdminCheckInWhere(filter?: AdminCheckInListFilter) {
  const conditions = [];
  const keyword = filter?.keyword?.trim();
  if (keyword) {
    const pattern = `%${keyword}%`;
    conditions.push(
      or(
        like(checkIns.cityCode, pattern),
        like(checkIns.remark, pattern),
        sql`JSON_UNQUOTE(JSON_EXTRACT(${checkIns.location}, '$.placeName')) LIKE ${pattern}`,
      )!,
    );
  }
  if (filter?.userId != null) {
    conditions.push(eq(checkIns.userId, filter.userId));
  }
  if (filter?.routeId != null) {
    conditions.push(eq(checkIns.routeId, filter.routeId));
  }
  const cityCode = filter?.cityCode?.trim();
  if (cityCode) {
    conditions.push(like(checkIns.cityCode, `%${cityCode}%`));
  }
  if (filter?.dateStart) {
    conditions.push(gte(checkIns.checkedAt, new Date(`${filter.dateStart}T00:00:00`)));
  }
  if (filter?.dateEnd) {
    conditions.push(lte(checkIns.checkedAt, new Date(`${filter.dateEnd}T23:59:59.999`)));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listAllCheckInsForAdminPaginated(
  page: number,
  pageSize: number,
  filter?: AdminCheckInListFilter,
) {
  return paginateCheckIns(buildAdminCheckInWhere(filter), page, pageSize);
}
