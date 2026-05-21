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
import { getAttractionById } from './attraction.service.js';

function toCheckInInfo(
  row: typeof checkIns.$inferSelect,
  cityMap?: Map<string, string>,
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
    const attraction = await getAttractionById(attractionId);
    if (!attraction) {
      throw new Error('关联景点不存在');
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
  throw new Error('请提供城市编码或关联景点');
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
    photos?: string[];
    remark?: string;
  },
) {
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
    remark: data.remark ?? null,
    status: CheckInStatus.APPROVED,
  });

  const id = Number(result.insertId);
  const rows = await db.select().from(checkIns).where(eq(checkIns.id, id)).limit(1);
  const cityMap = await buildCityMap([cityCode]);
  const checkIn = toCheckInInfo(rows[0]!, cityMap);

  const newAchievements = await evaluateAchievements(userId);
  return { checkIn, newAchievements };
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

export async function listAllCheckInsForAdmin() {
  const db = getDb();
  const rows = await db.select().from(checkIns).orderBy(desc(checkIns.checkedAt)).limit(100);
  return mapRowsToCheckInInfo(rows);
}
