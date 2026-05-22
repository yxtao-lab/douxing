import { eq, and, asc } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { achievements } from '../db/schema/achievements.js';
import { achievementDefinitions } from '../db/schema/achievement-definitions.js';
import { AchievementConditionType } from '@douxing/shared';
import type {
  AchievementCatalogItem,
  AchievementInfo,
  AchievementProgress,
} from '@douxing/shared';
import { ACHIEVEMENT_SEEDS } from '../data/achievement-seeds.js';
import { gatherUserCheckinStats, type UserCheckinStats } from './checkin-stats.service.js';

type DefinitionRow = typeof achievementDefinitions.$inferSelect;

function toDefinitionInfo(row: DefinitionRow) {
  return {
    id: row.id,
    achievementCode: row.achievementCode,
    name: row.name,
    description: row.description,
    category: row.category,
    conditionType: row.conditionType,
    conditionValue: row.conditionValue ?? null,
    iconUrl: row.iconUrl,
    pointsReward: row.pointsReward,
    sortOrder: row.sortOrder,
  };
}

function toAchievementInfo(
  unlockRow: typeof achievements.$inferSelect,
  definition: DefinitionRow,
): AchievementInfo {
  return {
    id: unlockRow.id,
    userId: unlockRow.userId,
    achievementType: unlockRow.achievementType,
    achievementCode: definition.achievementCode,
    name: definition.name,
    description: definition.description ?? unlockRow.description,
    category: definition.category,
    iconUrl: definition.iconUrl,
    pointsReward: definition.pointsReward,
    unlockedAt: unlockRow.unlockedAt.toISOString(),
  };
}

function getTargetCount(conditionValue: Record<string, unknown> | null | undefined): number {
  const minCount = conditionValue?.minCount;
  return typeof minCount === 'number' && minCount > 0 ? minCount : 1;
}

function cityCountSafe(stats: UserCheckinStats, cityCode: string) {
  return stats.cityCounts.get(cityCode) ?? 0;
}

export function computeAchievementProgress(
  definition: Pick<DefinitionRow, 'conditionType' | 'conditionValue'>,
  stats: UserCheckinStats,
): AchievementProgress | null {
  const conditionValue = definition.conditionValue ?? {};

  switch (definition.conditionType) {
    case AchievementConditionType.CITY_CHECKIN: {
      const cityCode = String(conditionValue.cityCode ?? '');
      const current = cityCountSafe(stats, cityCode);
      return { current: Math.min(current, 1), target: 1 };
    }
    case AchievementConditionType.TOTAL_CHECKINS:
      return { current: stats.totalCheckins, target: getTargetCount(conditionValue) };
    case AchievementConditionType.DISTINCT_CITIES:
      return { current: stats.distinctCities, target: getTargetCount(conditionValue) };
    case AchievementConditionType.PHOTO_CHECKIN:
      return { current: stats.hasPhotoCheckin ? 1 : 0, target: 1 };
    case AchievementConditionType.ROUTE_CHECKINS:
      return { current: stats.maxRouteCheckins, target: getTargetCount(conditionValue) };
    case AchievementConditionType.CONSECUTIVE_DAYS:
      return { current: stats.maxConsecutiveDays, target: getTargetCount(conditionValue) };
    case AchievementConditionType.DAILY_CHECKINS:
      return { current: stats.maxDailyCheckins, target: getTargetCount(conditionValue) };
    default:
      return null;
  }
}

function isAchievementCompleted(definition: DefinitionRow, stats: UserCheckinStats): boolean {
  const progress = computeAchievementProgress(definition, stats);
  if (!progress) return false;
  return progress.current >= progress.target;
}

async function unlockIfMissing(userId: number, definition: DefinitionRow) {
  const db = getDb();
  const existing = await db
    .select()
    .from(achievements)
    .where(
      and(
        eq(achievements.userId, userId),
        eq(achievements.achievementType, definition.achievementCode),
      ),
    )
    .limit(1);
  if (existing.length > 0) return null;

  const [result] = await db.insert(achievements).values({
    userId,
    achievementType: definition.achievementCode,
    description: definition.description,
  });

  const id = Number(result.insertId);
  const rows = await db.select().from(achievements).where(eq(achievements.id, id)).limit(1);
  return toAchievementInfo(rows[0]!, definition);
}

export async function seedAchievementDefinitions() {
  const db = getDb();
  const existing = await db.select({ id: achievementDefinitions.id }).from(achievementDefinitions).limit(1);
  if (existing.length > 0) {
    console.log('[seed] Achievement definitions already exist, skip');
    return;
  }

  for (const seed of ACHIEVEMENT_SEEDS) {
    await db.insert(achievementDefinitions).values({
      achievementCode: seed.achievementCode,
      name: seed.name,
      description: seed.description,
      category: seed.category,
      conditionType: seed.conditionType,
      conditionValue: seed.conditionValue,
      iconUrl: seed.iconUrl,
      pointsReward: seed.pointsReward,
      sortOrder: seed.sortOrder,
    });
  }
  console.log(`[seed] Created ${ACHIEVEMENT_SEEDS.length} achievement definitions`);
}

export async function evaluateAchievements(userId: number) {
  const db = getDb();
  const definitions = await db
    .select()
    .from(achievementDefinitions)
    .orderBy(asc(achievementDefinitions.sortOrder));
  if (definitions.length === 0) return [];

  const stats = await gatherUserCheckinStats(userId);
  const unlocked: AchievementInfo[] = [];

  for (const definition of definitions) {
    if (!isAchievementCompleted(definition, stats)) continue;
    const item = await unlockIfMissing(userId, definition);
    if (item) unlocked.push(item);
  }

  return unlocked;
}

export async function listAchievementCatalog(userId: number): Promise<AchievementCatalogItem[]> {
  const db = getDb();
  const definitions = await db
    .select()
    .from(achievementDefinitions)
    .orderBy(asc(achievementDefinitions.sortOrder));
  if (definitions.length === 0) return [];

  const unlockRows = await db.select().from(achievements).where(eq(achievements.userId, userId));
  const unlockMap = new Map(unlockRows.map((row) => [row.achievementType, row]));
  const stats = await gatherUserCheckinStats(userId);

  return definitions.map((definition) => {
    const unlockRow = unlockMap.get(definition.achievementCode);
    const progress = computeAchievementProgress(definition, stats);
    return {
      ...toDefinitionInfo(definition),
      unlocked: Boolean(unlockRow),
      unlockTime: unlockRow?.unlockedAt.toISOString() ?? null,
      progress,
    };
  });
}

export async function listUserAchievements(userId: number): Promise<AchievementInfo[]> {
  const db = getDb();
  const rows = await db
    .select({ unlock: achievements, definition: achievementDefinitions })
    .from(achievements)
    .innerJoin(
      achievementDefinitions,
      eq(achievements.achievementType, achievementDefinitions.achievementCode),
    )
    .where(eq(achievements.userId, userId))
    .orderBy(asc(achievementDefinitions.sortOrder));

  return rows.map((row) => toAchievementInfo(row.unlock, row.definition));
}
