import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { checkIns } from '../db/schema/check-ins.js';
import { users } from '../db/schema/users.js';
import { verificationPointEvents } from '../db/schema/verification-point-events.js';
import {
  CheckInStatus,
  LeaderboardMetric,
  LeaderboardPeriod,
  LEADERBOARD_DEFAULT_LIMIT,
  LEADERBOARD_MAX_LIMIT,
  UserStatus,
  ApiError,
  ApiMessageKey,
} from '@douxing/shared';
import type { LeaderboardEntry, LeaderboardResult } from '@douxing/shared';
import { rewritePublicAssetUrl } from '../utils/public-asset-url.util.js';

interface PeriodRange {
  period: string;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * 解析排行榜时间窗（本周 / 本月）。
 *
 * @param period - 周期标识
 * @returns 起止时间；非法周期返回 null
 */
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

/**
 * 解析排行榜指标。
 *
 * @param metric - 客户端指标
 * @returns 规范化指标
 */
function resolveMetric(metric: string) {
  if (metric === LeaderboardMetric.POINTS) return LeaderboardMetric.POINTS;
  return LeaderboardMetric.CHECKINS;
}

/**
 * 按指标取展示分值。
 *
 * @param checkinCount - 打卡次数
 * @param totalPoints - 验证积分合计
 * @param metric - 指标
 * @returns 排行分值
 */
function getMetricValue(checkinCount: number, totalPoints: number, metric: string) {
  return metric === LeaderboardMetric.POINTS ? totalPoints : checkinCount;
}

/**
 * 批量加载用户昵称头像。
 *
 * @param userIds - 用户 ID 列表
 * @returns userId → 资料
 */
async function loadUserProfiles(userIds: number[]) {
  const userMap = new Map<number, { nickname: string; avatar: string | null }>();
  if (userIds.length === 0) return userMap;

  const db = getDb();
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
      avatar: rewritePublicAssetUrl(user.avatar),
    });
  }
  return userMap;
}

/**
 * 获取排行榜。
 * POINTS 指标按 U4 验证积分账本汇总（与热度脱钩）；CHECKINS 仍按打卡次数。
 *
 * @param options.period - week | month
 * @param options.metric - checkins | points
 * @param options.limit - 返回条数
 * @param options.currentUserId - 当前用户（用于 myRank）
 * @returns 排行结果
 * @throws {ApiError} 周期非法
 */
export async function getLeaderboard(options: {
  period: string;
  metric: string;
  limit?: number;
  currentUserId?: number;
}): Promise<LeaderboardResult> {
  const range = resolvePeriodRange(options.period);
  if (!range) {
    throw new ApiError(ApiMessageKey.LEADERBOARD_INVALID_PERIOD);
  }

  const metric = resolveMetric(options.metric);
  const limit = Math.min(
    Math.max(options.limit ?? LEADERBOARD_DEFAULT_LIMIT, 1),
    LEADERBOARD_MAX_LIMIT,
  );
  const db = getDb();

  const checkinAgg = await db
    .select({
      userId: checkIns.userId,
      checkinCount: sql<number>`count(*)`,
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
    .groupBy(checkIns.userId);

  const checkinMap = new Map<number, number>();
  for (const row of checkinAgg) {
    checkinMap.set(row.userId, Number(row.checkinCount));
  }

  const pointsAgg = await db
    .select({
      userId: verificationPointEvents.userId,
      totalPoints: sql<number>`coalesce(sum(${verificationPointEvents.points}), 0)`,
    })
    .from(verificationPointEvents)
    .innerJoin(users, eq(verificationPointEvents.userId, users.id))
    .where(
      and(
        eq(users.status, UserStatus.ACTIVE),
        gte(verificationPointEvents.createdAt, range.periodStart),
        lte(verificationPointEvents.createdAt, range.periodEnd),
      ),
    )
    .groupBy(verificationPointEvents.userId);

  const pointsMap = new Map<number, number>();
  for (const row of pointsAgg) {
    pointsMap.set(row.userId, Number(row.totalPoints));
  }

  const userIdSet = new Set<number>([
    ...checkinMap.keys(),
    ...(metric === LeaderboardMetric.POINTS ? pointsMap.keys() : []),
  ]);
  if (metric === LeaderboardMetric.CHECKINS) {
    for (const id of checkinMap.keys()) userIdSet.add(id);
  }

  const userIds = [...userIdSet];
  const userMap = await loadUserProfiles(userIds);

  const ranked: LeaderboardEntry[] = userIds
    .map((userId) => {
      const checkinCount = checkinMap.get(userId) ?? 0;
      const totalPoints = pointsMap.get(userId) ?? 0;
      const profile = userMap.get(userId);
      return {
        rank: 0,
        userId,
        nickname: profile?.nickname ?? `用户${userId}`,
        avatar: rewritePublicAssetUrl(profile?.avatar ?? null),
        checkinCount,
        totalPoints,
        value: getMetricValue(checkinCount, totalPoints, metric),
        isMe: options.currentUserId != null && userId === options.currentUserId,
      };
    })
    .filter((entry) => entry.value > 0 || entry.checkinCount > 0)
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      if (b.checkinCount !== a.checkinCount) return b.checkinCount - a.checkinCount;
      return a.userId - b.userId;
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

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
