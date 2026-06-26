import { and, eq, gte, sql } from 'drizzle-orm';
import {
  CheckInStatus,
  findCityRegionByCode,
  getProvinceAdcodeBySlug,
  getProvinceGeoMapName,
  OTHER_PROVINCE_CODE,
  PROVINCE_CITY_REGIONS,
  type AnalyticsCityGeoStat,
  type AnalyticsGeoDistribution,
  type AnalyticsGeoFlow,
  type AnalyticsHeatPoint,
  type AnalyticsProvinceGeoStat,
  type LocaleCode,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { attractions } from '../db/schema/attractions.js';
import { checkIns } from '../db/schema/check-ins.js';

const ANALYTICS_MAX_GEO_DAYS = 90;
const ANALYTICS_DEFAULT_GEO_DAYS = 30;
const ANALYTICS_MAX_GEO_FLOWS = 50;
const ANALYTICS_MIN_FLOW_COUNT = 2;
const ANALYTICS_MAX_HEAT_POINTS = 200;
const HEAT_GRID_PRECISION = 1;

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function clampDays(daysInput?: number): number {
  return Math.min(ANALYTICS_MAX_GEO_DAYS, Math.max(1, daysInput ?? ANALYTICS_DEFAULT_GEO_DAYS));
}

function pickCityName(cityCode: string, locale: LocaleCode): string {
  const region = findCityRegionByCode(cityCode);
  if (!region) return cityCode;
  return locale === 'en-US' ? region.nameEn : region.nameZh;
}

function roundGrid(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

async function buildGeoDistribution(
  since: Date | null,
  locale: LocaleCode,
): Promise<AnalyticsGeoDistribution> {
  const db = getDb();
  const timeFilter = since ? [gte(checkIns.checkedAt, since)] : [];

  const [cityRows, heatRows] = await Promise.all([
    db
      .select({
        cityCode: checkIns.cityCode,
        checkinCount: sql<number>`COUNT(*)`.as('checkinCount'),
        latitude: sql<number>`AVG(COALESCE(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(${checkIns.location}, '$.latitude')) AS DECIMAL(10,6)),
          CAST(${attractions.latitude} AS DECIMAL(10,6))
        ))`.as('latitude'),
        longitude: sql<number>`AVG(COALESCE(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(${checkIns.location}, '$.longitude')) AS DECIMAL(10,6)),
          CAST(${attractions.longitude} AS DECIMAL(10,6))
        ))`.as('longitude'),
      })
      .from(checkIns)
      .leftJoin(attractions, eq(checkIns.attractionId, attractions.id))
      .where(and(eq(checkIns.status, CheckInStatus.APPROVED), ...timeFilter))
      .groupBy(checkIns.cityCode)
      .orderBy(sql`COUNT(*) DESC`),
    db
      .select({
        location: checkIns.location,
        attractionLatitude: attractions.latitude,
        attractionLongitude: attractions.longitude,
      })
      .from(checkIns)
      .leftJoin(attractions, eq(checkIns.attractionId, attractions.id))
      .where(and(eq(checkIns.status, CheckInStatus.APPROVED), ...timeFilter))
      .limit(5000),
  ]);

  const provinceCountMap = new Map<string, number>();
  const cities: AnalyticsCityGeoStat[] = [];

  for (const row of cityRows) {
    const count = Number(row.checkinCount ?? 0);
    if (count <= 0) continue;

    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      cities.push({
        cityCode: row.cityCode,
        cityName: pickCityName(row.cityCode, locale),
        latitude: lat,
        longitude: lng,
        checkinCount: count,
      });
    }

    const region = findCityRegionByCode(row.cityCode);
    const provinceCode = region?.provinceCode ?? OTHER_PROVINCE_CODE;
    provinceCountMap.set(provinceCode, (provinceCountMap.get(provinceCode) ?? 0) + count);
  }

  const provinces: AnalyticsProvinceGeoStat[] = [];
  for (const [provinceCode, checkinCount] of provinceCountMap.entries()) {
    if (provinceCode === OTHER_PROVINCE_CODE) continue;
    const meta = PROVINCE_CITY_REGIONS.find((item) => item.code === provinceCode);
    if (!meta) continue;
    const adcode = getProvinceAdcodeBySlug(provinceCode);
    if (!adcode) continue;
    provinces.push({
      provinceCode,
      geoName: getProvinceGeoMapName(meta.nameZh),
      adcode,
      checkinCount,
    });
  }
  provinces.sort((a, b) => b.checkinCount - a.checkinCount);

  const heatGrid = new Map<string, AnalyticsHeatPoint>();
  for (const row of heatRows) {
    const location = row.location;
    const lat = location?.latitude ?? (row.attractionLatitude != null ? Number(row.attractionLatitude) : null);
    const lng = location?.longitude ?? (row.attractionLongitude != null ? Number(row.attractionLongitude) : null);
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const gridLat = roundGrid(lat, HEAT_GRID_PRECISION);
    const gridLng = roundGrid(lng, HEAT_GRID_PRECISION);
    const key = `${gridLat},${gridLng}`;
    const existing = heatGrid.get(key);
    if (existing) {
      existing.weight += 1;
    } else {
      heatGrid.set(key, { latitude: gridLat, longitude: gridLng, weight: 1 });
    }
  }

  const heatPoints = [...heatGrid.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, ANALYTICS_MAX_HEAT_POINTS);

  return {
    provinces,
    cities: cities.slice(0, 30),
    heatPoints,
    generatedAt: new Date().toISOString(),
  };
}

export async function getAnalyticsGeoDistribution(
  daysInput?: number,
  locale: LocaleCode = 'zh-CN',
): Promise<AnalyticsGeoDistribution> {
  const days = clampDays(daysInput);
  const since = addLocalDays(startOfLocalDay(new Date()), -(days - 1));

  const windowResult = await buildGeoDistribution(since, locale);
  if (windowResult.provinces.length > 0 || windowResult.cities.length > 0) {
    return windowResult;
  }

  return buildGeoDistribution(null, locale);
}

export async function getAnalyticsGeoFlows(
  daysInput?: number,
  limitInput?: number,
  locale: LocaleCode = 'zh-CN',
): Promise<AnalyticsGeoFlow[]> {
  const days = clampDays(daysInput);
  const limit = Math.min(ANALYTICS_MAX_GEO_FLOWS, Math.max(1, limitInput ?? 20));
  const since = addLocalDays(startOfLocalDay(new Date()), -(days - 1));
  const db = getDb();

  const distribution = await getAnalyticsGeoDistribution(days, locale);
  const cityCoordMap = new Map(
    distribution.cities.map((city) => [
      city.cityCode,
      {
        lat: city.latitude,
        lng: city.longitude,
        name: city.cityName,
      },
    ]),
  );

  const rows = await db
    .select({
      userId: checkIns.userId,
      cityCode: checkIns.cityCode,
      checkedAt: checkIns.checkedAt,
    })
    .from(checkIns)
    .where(and(eq(checkIns.status, CheckInStatus.APPROVED), gte(checkIns.checkedAt, since)))
    .orderBy(checkIns.userId, checkIns.checkedAt);

  const flowMap = new Map<string, number>();
  let prevUserId: number | null = null;
  let prevCityCode: string | null = null;

  for (const row of rows) {
    if (prevUserId === row.userId && prevCityCode && prevCityCode !== row.cityCode) {
      const key = `${prevCityCode}→${row.cityCode}`;
      flowMap.set(key, (flowMap.get(key) ?? 0) + 1);
    }
    prevUserId = row.userId;
    prevCityCode = row.cityCode;
  }

  const flows: AnalyticsGeoFlow[] = [];
  for (const [key, count] of flowMap.entries()) {
    if (count < ANALYTICS_MIN_FLOW_COUNT) continue;
    const [fromCityCode, toCityCode] = key.split('→');
    if (!fromCityCode || !toCityCode) continue;
    const from = cityCoordMap.get(fromCityCode);
    const to = cityCoordMap.get(toCityCode);
    if (!from || !to) continue;
    flows.push({
      fromCityCode,
      toCityCode,
      fromName: from.name,
      toName: to.name,
      fromLatitude: from.lat,
      fromLongitude: from.lng,
      toLatitude: to.lat,
      toLongitude: to.lng,
      count,
    });
  }

  return flows.sort((a, b) => b.count - a.count).slice(0, limit);
}
