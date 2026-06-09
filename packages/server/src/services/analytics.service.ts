import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { analyticsEvents } from '../db/schema/analytics-events.js';
import { checkIns } from '../db/schema/check-ins.js';
import { orders } from '../db/schema/orders.js';
import { planSessions } from '../db/schema/plan-sessions.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { users } from '../db/schema/users.js';
import {
  AnalyticsEventCategory,
  AnalyticsEventSource,
  CheckInStatus,
  OrderStatus,
  type AnalyticsCityRankItem,
  type AnalyticsDailyPoint,
  type AnalyticsOverview,
  type TrackAnalyticsEventInput,
} from '@douxing/shared';

const ANALYTICS_MAX_TREND_DAYS = 90;
const ANALYTICS_DEFAULT_TREND_DAYS = 30;
const ANALYTICS_MAX_CITY_LIMIT = 50;
const ANALYTICS_DEFAULT_CITY_LIMIT = 10;

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

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDateRange(days: number): string[] {
  const today = startOfLocalDay(new Date());
  const start = addLocalDays(today, -(days - 1));
  const dates: string[] = [];
  for (let cursor = new Date(start); cursor <= today; cursor = addLocalDays(cursor, 1)) {
    dates.push(formatLocalDate(cursor));
  }
  return dates;
}

function mergeDailyCounts(
  dates: string[],
  rows: Array<{ date: string; count: number }>,
): Record<string, number> {
  const map = Object.fromEntries(dates.map((date) => [date, 0]));
  for (const row of rows) {
    if (row.date in map) {
      map[row.date] = Number(row.count) || 0;
    }
  }
  return map;
}

async function countSince(table: 'users' | 'routes' | 'orders' | 'checkins' | 'planSessions', since: Date) {
  const db = getDb();
  if (table === 'users') {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(gte(users.createdAt, since));
    return Number(row?.count ?? 0);
  }
  if (table === 'routes') {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(travelRoutes)
      .where(gte(travelRoutes.createdAt, since));
    return Number(row?.count ?? 0);
  }
  if (table === 'orders') {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(orders)
      .where(gte(orders.createdAt, since));
    return Number(row?.count ?? 0);
  }
  if (table === 'checkins') {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(checkIns)
      .where(gte(checkIns.checkedAt, since));
    return Number(row?.count ?? 0);
  }
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(planSessions)
    .where(gte(planSessions.createdAt, since));
  return Number(row?.count ?? 0);
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const db = getDb();
  const today = startOfLocalDay(new Date());
  const last7Days = addLocalDays(today, -6);

  const [
    usersTotalRow,
    routesTotalRow,
    publicRoutesRow,
    ordersTotalRow,
    paidOrdersRow,
    checkinsTotalRow,
    approvedCheckinsRow,
    planSessionsTotalRow,
    usersNewToday,
    usersNewLast7Days,
    routesNewLast7Days,
    ordersNewLast7Days,
    checkinsNewLast7Days,
    planSessionsNewLast7Days,
  ] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(users),
    db.select({ count: sql<number>`COUNT(*)` }).from(travelRoutes),
    db.select({ count: sql<number>`COUNT(*)` }).from(travelRoutes).where(eq(travelRoutes.isPublic, 1)),
    db.select({ count: sql<number>`COUNT(*)` }).from(orders),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(orders)
      .where(inArray(orders.status, [OrderStatus.PAID, OrderStatus.COMPLETED])),
    db.select({ count: sql<number>`COUNT(*)` }).from(checkIns),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(checkIns)
      .where(eq(checkIns.status, CheckInStatus.APPROVED)),
    db.select({ count: sql<number>`COUNT(*)` }).from(planSessions),
    countSince('users', today),
    countSince('users', last7Days),
    countSince('routes', last7Days),
    countSince('orders', last7Days),
    countSince('checkins', last7Days),
    countSince('planSessions', last7Days),
  ]);

  return {
    users: {
      total: Number(usersTotalRow[0]?.count ?? 0),
      newToday: usersNewToday,
      newLast7Days: usersNewLast7Days,
    },
    routes: {
      total: Number(routesTotalRow[0]?.count ?? 0),
      publicTotal: Number(publicRoutesRow[0]?.count ?? 0),
      newLast7Days: routesNewLast7Days,
    },
    orders: {
      total: Number(ordersTotalRow[0]?.count ?? 0),
      paidTotal: Number(paidOrdersRow[0]?.count ?? 0),
      newLast7Days: ordersNewLast7Days,
    },
    checkins: {
      total: Number(checkinsTotalRow[0]?.count ?? 0),
      approvedTotal: Number(approvedCheckinsRow[0]?.count ?? 0),
      newLast7Days: checkinsNewLast7Days,
    },
    planSessions: {
      total: Number(planSessionsTotalRow[0]?.count ?? 0),
      newLast7Days: planSessionsNewLast7Days,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function getAnalyticsTrends(daysInput?: number): Promise<AnalyticsDailyPoint[]> {
  const days = Math.min(
    ANALYTICS_MAX_TREND_DAYS,
    Math.max(1, daysInput ?? ANALYTICS_DEFAULT_TREND_DAYS),
  );
  const db = getDb();
  const dateRange = buildDateRange(days);
  const since = addLocalDays(startOfLocalDay(new Date()), -(days - 1));

  const [userRows, routeRows, orderRows, checkinRows, planRows] = await Promise.all([
    db
      .select({
        date: sql<string>`DATE(${users.createdAt})`.as('date'),
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(users)
      .where(gte(users.createdAt, since))
      .groupBy(sql`DATE(${users.createdAt})`),
    db
      .select({
        date: sql<string>`DATE(${travelRoutes.createdAt})`.as('date'),
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(travelRoutes)
      .where(gte(travelRoutes.createdAt, since))
      .groupBy(sql`DATE(${travelRoutes.createdAt})`),
    db
      .select({
        date: sql<string>`DATE(${orders.createdAt})`.as('date'),
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(orders)
      .where(gte(orders.createdAt, since))
      .groupBy(sql`DATE(${orders.createdAt})`),
    db
      .select({
        date: sql<string>`DATE(${checkIns.checkedAt})`.as('date'),
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(checkIns)
      .where(gte(checkIns.checkedAt, since))
      .groupBy(sql`DATE(${checkIns.checkedAt})`),
    db
      .select({
        date: sql<string>`DATE(${planSessions.createdAt})`.as('date'),
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(planSessions)
      .where(gte(planSessions.createdAt, since))
      .groupBy(sql`DATE(${planSessions.createdAt})`),
  ]);

  const usersMap = mergeDailyCounts(dateRange, userRows);
  const routesMap = mergeDailyCounts(dateRange, routeRows);
  const ordersMap = mergeDailyCounts(dateRange, orderRows);
  const checkinsMap = mergeDailyCounts(dateRange, checkinRows);
  const planSessionsMap = mergeDailyCounts(dateRange, planRows);

  return dateRange.map((date) => ({
    date,
    users: usersMap[date] ?? 0,
    routes: routesMap[date] ?? 0,
    orders: ordersMap[date] ?? 0,
    checkins: checkinsMap[date] ?? 0,
    planSessions: planSessionsMap[date] ?? 0,
  }));
}

export async function getTopCheckinCities(limitInput?: number): Promise<AnalyticsCityRankItem[]> {
  const limit = Math.min(
    ANALYTICS_MAX_CITY_LIMIT,
    Math.max(1, limitInput ?? ANALYTICS_DEFAULT_CITY_LIMIT),
  );
  const db = getDb();

  const rows = await db
    .select({
      cityCode: checkIns.cityCode,
      checkinCount: sql<number>`COUNT(*)`.as('checkinCount'),
    })
    .from(checkIns)
    .where(eq(checkIns.status, CheckInStatus.APPROVED))
    .groupBy(checkIns.cityCode)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit);

  return rows.map((row) => ({
    cityCode: row.cityCode,
    checkinCount: Number(row.checkinCount ?? 0),
  }));
}

export async function trackAnalyticsEvent(input: TrackAnalyticsEventInput): Promise<void> {
  const db = getDb();
  const category = input.eventCategory ?? AnalyticsEventCategory.BUSINESS;
  const source = input.source ?? AnalyticsEventSource.SERVER;

  await db.insert(analyticsEvents).values({
    eventName: input.eventName,
    eventCategory: category,
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
    properties: input.properties ?? null,
    source,
    occurredAt: input.occurredAt ?? new Date(),
  });
}
