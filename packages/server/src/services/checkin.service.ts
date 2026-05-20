import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { checkIns, type CheckInLocation } from '../db/schema/check-ins.js';
import { CheckInStatus } from '@douxing/shared';
import type { CheckInInfo } from '@douxing/shared';
import { evaluateAchievements } from './achievement.service.js';

function toCheckInInfo(row: typeof checkIns.$inferSelect): CheckInInfo {
  return {
    id: row.id,
    userId: row.userId,
    routeId: row.routeId,
    attractionId: row.attractionId ?? null,
    location: row.location,
    checkedAt: row.checkedAt.toISOString(),
    status: row.status,
    remark: row.remark,
  };
}

export async function createCheckIn(
  userId: number,
  data: {
    routeId: number;
    location: CheckInLocation;
    attractionId?: number;
    remark?: string;
  },
) {
  const db = getDb();
  const [result] = await db.insert(checkIns).values({
    userId,
    routeId: data.routeId,
    attractionId: data.attractionId ?? null,
    location: data.location,
    remark: data.remark ?? null,
    status: CheckInStatus.APPROVED,
  });

  const id = Number(result.insertId);
  const rows = await db.select().from(checkIns).where(eq(checkIns.id, id)).limit(1);
  const checkIn = toCheckInInfo(rows[0]!);

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
  return rows.map(toCheckInInfo);
}

export async function listRouteCheckIns(routeId: number, userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(checkIns)
    .where(and(eq(checkIns.routeId, routeId), eq(checkIns.userId, userId)))
    .orderBy(desc(checkIns.checkedAt));
  return rows.map(toCheckInInfo);
}

export async function listAllCheckInsForAdmin() {
  const db = getDb();
  const rows = await db.select().from(checkIns).orderBy(desc(checkIns.checkedAt)).limit(100);
  return rows.map(toCheckInInfo);
}
