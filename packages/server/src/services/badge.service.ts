import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { badges } from '../db/schema/badges.js';
import { userBadges } from '../db/schema/user-badges.js';
import { BadgeConditionType } from '@douxing/shared';
import type { BadgeCatalogItem, BadgeInfo, BadgeProgress, UserBadgeInfo } from '@douxing/shared';
import { BADGE_SEEDS } from '../data/badge-seeds.js';
import { gatherUserCheckinStats, type UserCheckinStats } from './checkin-stats.service.js';

function toBadgeInfo(row: typeof badges.$inferSelect): BadgeInfo {
  return {
    id: row.id,
    badgeCode: row.badgeCode,
    name: row.name,
    description: row.description,
    category: row.category,
    conditionType: row.conditionType,
    conditionValue: row.conditionValue ?? null,
    iconUrl: row.iconUrl,
    rarity: row.rarity,
    pointsReward: row.pointsReward,
  };
}

function toUserBadgeInfo(
  userBadgeRow: typeof userBadges.$inferSelect,
  badgeRow: typeof badges.$inferSelect,
): UserBadgeInfo {
  return {
    id: userBadgeRow.id,
    userId: userBadgeRow.userId,
    badgeId: userBadgeRow.badgeId,
    badge: toBadgeInfo(badgeRow),
    unlockTime: userBadgeRow.unlockTime.toISOString(),
    isDisplayed: userBadgeRow.isDisplayed,
    progress: userBadgeRow.progress ?? null,
  };
}

function getTargetCount(conditionValue: Record<string, unknown> | null | undefined): number {
  const minCount = conditionValue?.minCount;
  return typeof minCount === 'number' && minCount > 0 ? minCount : 1;
}

function computeProgress(
  badge: typeof badges.$inferSelect,
  stats: UserCheckinStats,
): BadgeProgress | null {
  const conditionValue = badge.conditionValue ?? {};

  switch (badge.conditionType) {
    case BadgeConditionType.CITY_CHECKIN: {
      const cityCode = String(conditionValue.cityCode ?? '');
      const current = cityCountsSafe(stats, cityCode);
      return { current: Math.min(current, 1), target: 1 };
    }
    case BadgeConditionType.TOTAL_CHECKINS:
      return {
        current: stats.totalCheckins,
        target: getTargetCount(conditionValue),
      };
    case BadgeConditionType.DISTINCT_CITIES:
      return {
        current: stats.distinctCities,
        target: getTargetCount(conditionValue),
      };
    case BadgeConditionType.PHOTO_CHECKIN:
      return { current: stats.hasPhotoCheckin ? 1 : 0, target: 1 };
    case BadgeConditionType.ROUTE_CHECKINS:
      return {
        current: stats.maxRouteCheckins,
        target: getTargetCount(conditionValue),
      };
    default:
      return null;
  }
}

function cityCountsSafe(stats: UserCheckinStats, cityCode: string) {
  return stats.cityCounts.get(cityCode) ?? 0;
}

function isBadgeUnlocked(badge: typeof badges.$inferSelect, stats: UserCheckinStats): boolean {
  const progress = computeProgress(badge, stats);
  if (!progress) return false;
  return progress.current >= progress.target;
}

async function unlockIfMissing(
  userId: number,
  badge: typeof badges.$inferSelect,
  progress: BadgeProgress | null,
) {
  const db = getDb();
  const existing = await db
    .select()
    .from(userBadges)
    .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badge.id)))
    .limit(1);
  if (existing.length > 0) return null;

  const [result] = await db.insert(userBadges).values({
    userId,
    badgeId: badge.id,
    progress: progress ? { current: progress.current, target: progress.target } : undefined,
  });

  const id = Number(result.insertId);
  const rows = await db.select().from(userBadges).where(eq(userBadges.id, id)).limit(1);
  return toUserBadgeInfo(rows[0]!, badge);
}

export async function seedBadges() {
  const db = getDb();
  const existing = await db.select({ id: badges.id }).from(badges).limit(1);
  if (existing.length > 0) {
    console.log('[seed] Badges already exist, skip');
    return;
  }

  for (const seed of BADGE_SEEDS) {
    await db.insert(badges).values({
      badgeCode: seed.badgeCode,
      name: seed.name,
      description: seed.description,
      category: seed.category,
      conditionType: seed.conditionType,
      conditionValue: seed.conditionValue,
      iconUrl: seed.iconUrl,
      rarity: seed.rarity,
      pointsReward: seed.pointsReward,
    });
  }
  console.log(`[seed] Created ${BADGE_SEEDS.length} badges`);
}

export async function evaluateBadges(userId: number) {
  const db = getDb();
  const allBadges = await db.select().from(badges);
  if (allBadges.length === 0) return [];

  const stats = await gatherUserCheckinStats(userId);
  const unlocked: UserBadgeInfo[] = [];

  for (const badge of allBadges) {
    if (!isBadgeUnlocked(badge, stats)) continue;
    const progress = computeProgress(badge, stats);
    const item = await unlockIfMissing(userId, badge, progress);
    if (item) unlocked.push(item);
  }

  return unlocked;
}

export async function listBadgeCatalog(userId: number): Promise<BadgeCatalogItem[]> {
  const db = getDb();
  const allBadges = await db.select().from(badges);
  if (allBadges.length === 0) return [];

  const userRows = await db
    .select()
    .from(userBadges)
    .where(eq(userBadges.userId, userId));
  const unlockMap = new Map(userRows.map((row) => [row.badgeId, row]));
  const stats = await gatherUserCheckinStats(userId);

  return allBadges.map((badge) => {
    const unlockedRow = unlockMap.get(badge.id);
    const progress = computeProgress(badge, stats);
    return {
      ...toBadgeInfo(badge),
      unlocked: Boolean(unlockedRow),
      unlockTime: unlockedRow?.unlockTime.toISOString() ?? null,
      progress,
    };
  });
}

export async function listUserBadges(userId: number): Promise<UserBadgeInfo[]> {
  const db = getDb();
  const rows = await db
    .select({ userBadge: userBadges, badge: badges })
    .from(userBadges)
    .innerJoin(badges, eq(userBadges.badgeId, badges.id))
    .where(eq(userBadges.userId, userId));

  return rows.map((row) => toUserBadgeInfo(row.userBadge, row.badge));
}
