import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { checkIns } from '../db/schema/check-ins.js';
import { users } from '../db/schema/users.js';
import {
  CheckInStatus,
  LeaderboardMetric,
  LeaderboardPeriod,
  LEADERBOARD_DEFAULT_LIMIT,
  LEADERBOARD_MAX_LIMIT,
  UserStatus,
} from '@douxing/shared';
import type { LeaderboardEntry, LeaderboardResult } from '@douxing/shared';

interface PeriodRange {
  period: string;
  periodStart: Date;
  periodEnd: Date;
}

function resolvePeriodRange(period: string): PeriodRange | null {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setHours(23, 59, 59, 999);

  if (period === LeaderboardPeriod.WEEK) {
    const periodStart = new Date(now);
    periodStart.setHours(0, 0, 0, 0);
    const day = periodStart.getDay();
    const diff = day === 0 ? 6 : day - 1;
    periodStart.setDate(periodStart.getDate() - diff);
    return { period, periodStart, periodEnd };
  }

  if (period === LeaderboardPeriod.MONTH) {
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodStart.setHours(0, 0, 0, 0);
    return { period, periodStart, periodEnd };
  }

  return null;
}

function resolveMetric(metric: string) {
  if (metric === LeaderboardMetric.POINTS) return LeaderboardMetric.POINTS;
  return LeaderboardMetric.CHECKINS;
}

function getMetricValue(checkinCount: number, totalPoints: number, metric: string) {
  return metric === LeaderboardMetric.POINTS ? totalPoints : checkinCount;
}

export async function getLeaderboard(options: {
  period: string;
  metric: string;
  limit?: number;
  currentUserId?: number;
}): Promise<LeaderboardResult> {
  const range = resolvePeriodRange(options.period);
  if (!range) {
    throw new Error('无效的排行榜周期');
  }

  const metric = resolveMetric(options.metric);
  const limit = Math.min(
    Math.max(options.limit ?? LEADERBOARD_DEFAULT_LIMIT, 1),
    LEADERBOARD_MAX_LIMIT,
  );
  const db = getDb();

  const aggregated = await db
    .select({
      userId: checkIns.userId,
      checkinCount: sql<number>`count(*)`,
      totalPoints: sql<number>`coalesce(sum(${checkIns.pointsEarned}), 0)`,
    })
    .from(checkIns)
    .innerJoin(users, eq(checkIns.userId, users.id))
    .where(
      and(
        eq(checkIns.status, CheckInStatus.APPROVED),
        eq(users.status, UserStatus.ACTIVE),
        gte(checkIns.checkedAt, range.periodStart),
        lte(checkIns.checkedAt, range.periodEnd),
      ),
    )
    .groupBy(checkIns.userId)
    .orderBy(
      desc(
        metric === LeaderboardMetric.POINTS
          ? sql`coalesce(sum(${checkIns.pointsEarned}), 0)`
          : sql`count(*)`,
      ),
      desc(sql`count(*)`),
      checkIns.userId,
    );

  const userIds = aggregated.map((row) => row.userId);
  const userMap = new Map<number, { nickname: string; avatar: string | null }>();

  if (userIds.length > 0) {
    const userRows = await db
      .select({
        id: users.id,
        nickname: users.nickname,
        username: users.username,
        avatar: users.avatar,
      })
      .from(users)
      .where(inArray(users.id, userIds));

    for (const user of userRows) {
      userMap.set(user.id, {
        nickname: user.nickname || user.username,
        avatar: user.avatar,
      });
    }
  }

  const ranked: LeaderboardEntry[] = aggregated.map((row, index) => {
    const checkinCount = Number(row.checkinCount);
    const totalPoints = Number(row.totalPoints);
    const profile = userMap.get(row.userId);
    return {
      rank: index + 1,
      userId: row.userId,
      nickname: profile?.nickname ?? `用户${row.userId}`,
      avatar: profile?.avatar ?? null,
      checkinCount,
      totalPoints,
      value: getMetricValue(checkinCount, totalPoints, metric),
      isMe: options.currentUserId != null && row.userId === options.currentUserId,
    };
  });

  const topEntries = ranked.slice(0, limit);
  const currentUserId = options.currentUserId;
  let myRank: number | null = null;
  let myValue: number | null = null;

  if (currentUserId != null) {
    const mine = ranked.find((entry) => entry.userId === currentUserId);
    if (mine) {
      myRank = mine.rank;
      myValue = mine.value;
    } else {
      myRank = null;
      myValue = 0;
    }
  }

  return {
    period: range.period,
    metric,
    periodStart: range.periodStart.toISOString(),
    periodEnd: range.periodEnd.toISOString(),
    entries: topEntries,
    myRank,
    myValue,
  };
}
