import { and, gte, lt, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { analyticsDailyMetrics } from '../db/schema/analytics-daily-metrics.js';
import { checkIns } from '../db/schema/check-ins.js';
import { orders } from '../db/schema/orders.js';
import { planSessions } from '../db/schema/plan-sessions.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { users } from '../db/schema/users.js';
import type { AnalyticsDailyPoint } from '@douxing/shared';

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

function dayBounds(metricDate: string): { start: Date; end: Date } {
  const start = startOfLocalDay(new Date(`${metricDate}T00:00:00`));
  const end = addLocalDays(start, 1);
  return { start, end };
}

async function countInRange(
  table: 'users' | 'routes' | 'orders' | 'checkins' | 'planSessions',
  start: Date,
  end: Date,
): Promise<number> {
  const db = getDb();

  if (table === 'users') {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(and(gte(users.createdAt, start), lt(users.createdAt, end)));
    return Number(row?.count ?? 0);
  }
  if (table === 'routes') {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(travelRoutes)
      .where(and(gte(travelRoutes.createdAt, start), lt(travelRoutes.createdAt, end)));
    return Number(row?.count ?? 0);
  }
  if (table === 'orders') {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(orders)
      .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)));
    return Number(row?.count ?? 0);
  }
  if (table === 'checkins') {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(checkIns)
      .where(and(gte(checkIns.checkedAt, start), lt(checkIns.checkedAt, end)));
    return Number(row?.count ?? 0);
  }
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(planSessions)
    .where(and(gte(planSessions.createdAt, start), lt(planSessions.createdAt, end)));
  return Number(row?.count ?? 0);
}

/** 只读聚合指定日期指标（不写汇总表） */
export async function aggregateMetricsForDate(metricDate: string): Promise<AnalyticsDailyPoint> {
  const { start, end } = dayBounds(metricDate);

  const [usersNew, routesNew, ordersNew, checkinsNew, planSessionsNew] = await Promise.all([
    countInRange('users', start, end),
    countInRange('routes', start, end),
    countInRange('orders', start, end),
    countInRange('checkins', start, end),
    countInRange('planSessions', start, end),
  ]);

  return {
    date: metricDate,
    users: usersNew,
    routes: routesNew,
    orders: ordersNew,
    checkins: checkinsNew,
    planSessions: planSessionsNew,
  };
}

/** 聚合指定日期的五项指标并 upsert 到汇总表 */
export async function rollupAnalyticsDailyMetricsForDate(metricDate: string): Promise<AnalyticsDailyPoint> {
  const point = await aggregateMetricsForDate(metricDate);
  const db = getDb();

  await db
    .insert(analyticsDailyMetrics)
    .values({
      metricDate,
      usersNew: point.users,
      routesNew: point.routes,
      ordersNew: point.orders,
      checkinsNew: point.checkins,
      planSessionsNew: point.planSessions,
    })
    .onDuplicateKeyUpdate({
      set: {
        usersNew: point.users,
        routesNew: point.routes,
        ordersNew: point.orders,
        checkinsNew: point.checkins,
        planSessionsNew: point.planSessions,
        rolledUpAt: new Date(),
      },
    });

  return point;
}

/** 默认跑批目标：昨日（T+1） */
export function getDefaultRollupDate(): string {
  return formatLocalDate(addLocalDays(startOfLocalDay(new Date()), -1));
}

/** 回填最近 N 天（不含今日） */
export async function backfillAnalyticsDailyMetrics(days: number): Promise<number> {
  const safeDays = Math.min(90, Math.max(1, days));
  const today = startOfLocalDay(new Date());
  let rolled = 0;

  for (let offset = safeDays; offset >= 1; offset -= 1) {
    const metricDate = formatLocalDate(addLocalDays(today, -offset));
    await rollupAnalyticsDailyMetricsForDate(metricDate);
    rolled += 1;
  }

  return rolled;
}

export { formatLocalDate, startOfLocalDay, addLocalDays };
