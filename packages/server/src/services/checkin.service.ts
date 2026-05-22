import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { checkIns, type CheckInLocation } from '../db/schema/check-ins.js';
import { attractions } from '../db/schema/attractions.js';
import {
  CheckInStatus,
  CHECKIN_BASE_POINTS,
  CHECKIN_PHOTO_BONUS,
  CHECKIN_FIRST_ATTRACTION_BONUS,
  CHECKIN_MAX_PHOTOS,
} from '@douxing/shared';
import type { CheckInInfo } from '@douxing/shared';
import { evaluateAchievements } from './achievement.service.js';
import { evaluateBadges } from './badge.service.js';
import { getAttractionForCheckIn } from './attraction.service.js';
import {
  assertNotCheckedInToday,
  validateCheckInGeofence,
} from './checkin-geofence.service.js';
import { CheckinValidationError } from '../utils/checkin-errors.js';

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
    photos: row.photos ?? [],
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
  return rows.map((row) => toCheckInInfo(row, cityMap));
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

function calculatePoints(hasPhotos: boolean, isFirstAtAttraction: boolean) {
  let points = CHECKIN_BASE_POINTS;
  if (hasPhotos) points += CHECKIN_PHOTO_BONUS;
  if (isFirstAtAttraction) points += CHECKIN_FIRST_ATTRACTION_BONUS;
  return points;
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
  },
) {
  if (data.location.latitude == null || data.location.longitude == null) {
    throw new CheckinValidationError('请上报当前 GPS 位置');
  }

  await assertNotCheckedInToday(userId, data.attractionId);

  const distanceMeters = await validateCheckInGeofence({
    userId,
    userLatitude: data.location.latitude,
    userLongitude: data.location.longitude,
    gpsAccuracy: data.gpsAccuracy,
    attractionId: data.attractionId,
    targetLatitude: data.targetLatitude,
    targetLongitude: data.targetLongitude,
  });

  const photos = (data.photos ?? []).slice(0, CHECKIN_MAX_PHOTOS);
  const cityCode = await resolveCityCode(data.attractionId, data.cityCode, data.cityName);
  const isFirstAtAttraction = await isFirstCheckInAtAttraction(userId, data.attractionId);
  const pointsEarned = calculatePoints(photos.length > 0, isFirstAtAttraction);

  const db = getDb();
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

  const newAchievements = await evaluateAchievements(userId);
  const newBadges = await evaluateBadges(userId);
  return { checkIn, newAchievements, newBadges };
}

export async function listUserCheckIns(userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(checkIns)
    .where(eq(checkIns.userId, userId))
    .orderBy(desc(checkIns.checkedAt));
  return mapRowsToCheckInInfo(rows);
}

export async function listRouteCheckIns(routeId: number, userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(checkIns)
    .where(and(eq(checkIns.routeId, routeId), eq(checkIns.userId, userId)))
    .orderBy(desc(checkIns.checkedAt));
  return mapRowsToCheckInInfo(rows);
}

export async function listAllCheckInsForAdmin(limit = 500) {
  const db = getDb();
  const safeLimit = Math.min(Math.max(limit, 1), 1000);
  const rows = await db.select().from(checkIns).orderBy(desc(checkIns.checkedAt)).limit(safeLimit);
  return mapRowsToCheckInInfo(rows);
}
