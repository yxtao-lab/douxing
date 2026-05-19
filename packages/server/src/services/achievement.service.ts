import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { achievements } from '../db/schema/achievements.js';
import { checkIns } from '../db/schema/check-ins.js';
import { AchievementType } from '@douxing/shared';
import type { AchievementInfo } from '@douxing/shared';

const ACHIEVEMENT_META: Record<
  string,
  { description: string }
> = {
  [AchievementType.FIRST_CHECKIN]: { description: '完成首次旅行打卡' },
  [AchievementType.EXPLORER]: { description: '累计打卡达到 3 次' },
  [AchievementType.ROUTE_MASTER]: { description: '在同一路线打卡 2 个景点' },
};

function toAchievementInfo(row: typeof achievements.$inferSelect): AchievementInfo {
  return {
    id: row.id,
    userId: row.userId,
    achievementType: row.achievementType,
    unlockedAt: row.unlockedAt.toISOString(),
    description: row.description,
  };
}

async function unlockIfMissing(userId: number, type: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(achievements)
    .where(and(eq(achievements.userId, userId), eq(achievements.achievementType, type)))
    .limit(1);
  if (existing.length > 0) return null;

  const meta = ACHIEVEMENT_META[type];
  const [result] = await db.insert(achievements).values({
    userId,
    achievementType: type,
    description: meta?.description ?? type,
  });

  const id = Number(result.insertId);
  const rows = await db.select().from(achievements).where(eq(achievements.id, id)).limit(1);
  return toAchievementInfo(rows[0]!);
}

export async function evaluateAchievements(userId: number) {
  const db = getDb();
  const unlocked: AchievementInfo[] = [];

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(checkIns)
    .where(eq(checkIns.userId, userId));
  const total = Number(countRows[0]?.count ?? 0);

  if (total >= 1) {
    const a = await unlockIfMissing(userId, AchievementType.FIRST_CHECKIN);
    if (a) unlocked.push(a);
  }
  if (total >= 3) {
    const a = await unlockIfMissing(userId, AchievementType.EXPLORER);
    if (a) unlocked.push(a);
  }

  const routeCounts = await db
    .select({
      routeId: checkIns.routeId,
      count: sql<number>`count(*)`,
    })
    .from(checkIns)
    .where(eq(checkIns.userId, userId))
    .groupBy(checkIns.routeId);

  const hasRouteMaster = routeCounts.some((r) => Number(r.count) >= 2);
  if (hasRouteMaster) {
    const a = await unlockIfMissing(userId, AchievementType.ROUTE_MASTER);
    if (a) unlocked.push(a);
  }

  return unlocked;
}

export async function listUserAchievements(userId: number) {
  const db = getDb();
  const rows = await db.select().from(achievements).where(eq(achievements.userId, userId));
  return rows.map(toAchievementInfo);
}
