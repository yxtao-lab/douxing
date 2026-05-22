import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { checkIns } from '../db/schema/check-ins.js';

export interface UserCheckinStats {
  totalCheckins: number;
  distinctCities: number;
  cityCounts: Map<string, number>;
  hasPhotoCheckin: boolean;
  maxRouteCheckins: number;
  maxConsecutiveDays: number;
  maxDailyCheckins: number;
}

function calcMaxConsecutiveDays(dayStrings: string[]): number {
  if (dayStrings.length === 0) return 0;

  const uniqueDays = [...new Set(dayStrings)].sort();
  let maxStreak = 1;
  let current = 1;

  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(`${uniqueDays[i - 1]}T00:00:00`);
    const curr = new Date(`${uniqueDays[i]}T00:00:00`);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      current += 1;
    } else {
      current = 1;
    }
    maxStreak = Math.max(maxStreak, current);
  }

  return maxStreak;
}

export async function gatherUserCheckinStats(userId: number): Promise<UserCheckinStats> {
  const db = getDb();

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(checkIns)
    .where(eq(checkIns.userId, userId));
  const totalCheckins = Number(countRows[0]?.count ?? 0);

  const cityRows = await db
    .select({
      cityCode: checkIns.cityCode,
      count: sql<number>`count(*)`,
    })
    .from(checkIns)
    .where(eq(checkIns.userId, userId))
    .groupBy(checkIns.cityCode);

  const cityCounts = new Map<string, number>();
  for (const row of cityRows) {
    cityCounts.set(row.cityCode, Number(row.count));
  }

  const photoRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(checkIns)
    .where(
      and(
        eq(checkIns.userId, userId),
        sql`${checkIns.photos} IS NOT NULL AND JSON_LENGTH(${checkIns.photos}) > 0`,
      ),
    );
  const hasPhotoCheckin = Number(photoRows[0]?.count ?? 0) > 0;

  const routeRows = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(checkIns)
    .where(eq(checkIns.userId, userId))
    .groupBy(checkIns.routeId);

  const maxRouteCheckins = routeRows.reduce((max, row) => Math.max(max, Number(row.count)), 0);

  const dayRows = await db
    .select({ day: sql<string>`DATE(${checkIns.checkedAt})` })
    .from(checkIns)
    .where(eq(checkIns.userId, userId));

  const dayCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(checkIns)
    .where(eq(checkIns.userId, userId))
    .groupBy(sql`DATE(${checkIns.checkedAt})`);

  const maxDailyCheckins = dayCountRows.reduce((max, row) => Math.max(max, Number(row.count)), 0);
  const maxConsecutiveDays = calcMaxConsecutiveDays(dayRows.map((row) => row.day));

  return {
    totalCheckins,
    distinctCities: cityCounts.size,
    cityCounts,
    hasPhotoCheckin,
    maxRouteCheckins,
    maxConsecutiveDays,
    maxDailyCheckins,
  };
}
