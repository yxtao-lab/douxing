/**
 * Phase 4：H3 宠物记忆读写
 */
import { desc, eq, and, sql } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  TRAVEL_PET_DEFAULT_NICKNAME,
  buildPaginatedResult,
  type LocaleCode,
  type MemoryRecallExplainItem,
  type MemoryRecallPackage,
  type PaginatedResult,
  type PetMemoryWallItem,
  type PetSuggestedMemory,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { petMemories, travelPets } from '../db/schema/index.js';

export const PetMemoryType = {
  PREFERENCE: 'preference',
  REGRET: 'regret',
  VISITED: 'visited',
  TRIP_SUMMARY: 'trip_summary',
  MILESTONE: 'milestone',
} as const;

export type PetMemoryTypeValue = (typeof PetMemoryType)[keyof typeof PetMemoryType];

export interface RecalledMemory {
  id: number;
  memoryType: string;
  content: string;
  importance: number;
  metadata?: Record<string, unknown> | null;
}

export async function ensureTravelPet(userId: number) {
  const db = getDb();
  const existing = await db
    .select()
    .from(travelPets)
    .where(eq(travelPets.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];

  const [result] = await db.insert(travelPets).values({
    userId,
    nickname: TRAVEL_PET_DEFAULT_NICKNAME,
    species: 'fox',
    personality: 'guide',
  });
  const rows = await db
    .select()
    .from(travelPets)
    .where(eq(travelPets.id, Number(result.insertId)))
    .limit(1);
  return rows[0]!;
}

export async function recallUserMemory(
  userId: number,
  options?: { query?: string; limit?: number; types?: PetMemoryTypeValue[] },
): Promise<RecalledMemory[]> {
  try {
    const db = getDb();
    const limit = Math.min(Math.max(options?.limit ?? 8, 1), 20);
    const rows = await db
      .select()
      .from(petMemories)
      .where(eq(petMemories.userId, userId))
      .orderBy(desc(petMemories.importance), desc(petMemories.updatedAt))
      .limit(limit * 3);

    const query = options?.query?.trim().toLowerCase() ?? '';
    const typeSet = options?.types ? new Set(options.types) : null;

    const filtered = rows.filter((row) => {
      if (typeSet && !typeSet.has(row.memoryType as PetMemoryTypeValue)) return false;
      if (!query) return true;
      return row.content.toLowerCase().includes(query);
    });

    return filtered.slice(0, limit).map((row) => ({
      id: row.id,
      memoryType: row.memoryType,
      content: row.content,
      importance: row.importance,
      metadata: row.metadata,
    }));
  } catch (err) {
    console.warn(
      '[pet-memory] recall 失败，跳过记忆注入:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function writeTripMemory(input: {
  userId: number;
  memoryType: PetMemoryTypeValue;
  content: string;
  importance?: number;
  metadata?: Record<string, unknown>;
}): Promise<number | null> {
  try {
    const pet = await ensureTravelPet(input.userId);
    const db = getDb();
    const [result] = await db.insert(petMemories).values({
      userId: input.userId,
      petId: pet.id,
      memoryType: input.memoryType,
      content: input.content.trim(),
      importance: input.importance ?? 5,
      metadata: input.metadata,
    });
    return Number(result.insertId);
  } catch (err) {
    console.warn(
      '[pet-memory] write 失败，跳过:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export function extractMemoryThemes(memories: RecalledMemory[]): string[] {
  const themes = new Set<string>();
  for (const m of memories) {
    if (m.memoryType === PetMemoryType.PREFERENCE) {
      for (const part of m.content.split(/[，,、]/)) {
        const t = part.trim();
        if (t.length >= 2 && t.length <= 8) themes.add(t);
      }
    }
  }
  return [...themes].slice(0, 6);
}

export function extractVisitedPoiNames(memories: RecalledMemory[]): string[] {
  const names: string[] = [];
  for (const m of memories) {
    if (m.memoryType === PetMemoryType.VISITED || m.memoryType === PetMemoryType.REGRET) {
      const metaName = m.metadata?.poiName;
      if (typeof metaName === 'string' && metaName.trim()) {
        names.push(metaName.trim());
      } else {
        names.push(m.content.trim());
      }
    }
  }
  return [...new Set(names)].slice(0, 30);
}

export function extractBoostPoiNames(memories: RecalledMemory[]): string[] {
  const names: string[] = [];
  for (const m of memories) {
    if (m.memoryType === PetMemoryType.REGRET) {
      const metaName = m.metadata?.poiName;
      if (typeof metaName === 'string' && metaName.trim()) {
        names.push(metaName.trim());
      }
    }
  }
  return [...new Set(names)].slice(0, 10);
}

const MEMORY_RECALL_REASON: Record<LocaleCode, Record<string, string>> = {
  'zh-CN': {
    preference: '稳定偏好标签',
    regret: '上次遗憾·建议优先补偿',
    visited: '已到访·避免重复安排',
    trip_summary: '历史行程摘要',
    milestone: '旅行里程碑',
  },
  'en-US': {
    preference: 'Stable preference',
    regret: 'Past regret · prioritize makeup',
    visited: 'Already visited · avoid repeats',
    trip_summary: 'Past trip summary',
    milestone: 'Travel milestone',
  },
};

function resolveMemoryRecallReason(memoryType: string, locale: LocaleCode): string {
  const table = MEMORY_RECALL_REASON[locale] ?? MEMORY_RECALL_REASON['zh-CN'];
  return table[memoryType] ?? (locale === 'en-US' ? 'Recalled memory' : '相关记忆');
}

export function buildMemoryRecallExplain(
  memories: RecalledMemory[],
  locale: LocaleCode = 'zh-CN',
): { memorySummary: string; recallExplain: MemoryRecallExplainItem[] } {
  const recallExplain: MemoryRecallExplainItem[] = memories.map((m) => ({
    memoryType: m.memoryType,
    content: m.content,
    reason: resolveMemoryRecallReason(m.memoryType, locale),
  }));

  if (recallExplain.length === 0) {
    return {
      memorySummary: locale === 'en-US' ? 'No past trip memories yet' : '暂无历史旅行记忆',
      recallExplain,
    };
  }

  const bullets = recallExplain.slice(0, 5).map((item) => `· ${item.content}`);
  const memorySummary =
    locale === 'en-US'
      ? `Recalled ${recallExplain.length} memory item(s): ${bullets.join(' ')}`
      : `召回 ${recallExplain.length} 条记忆：${bullets.join(' ')}`;

  return { memorySummary, recallExplain };
}

export function buildMemoryRecallPackage(
  memories: RecalledMemory[],
  locale: LocaleCode = 'zh-CN',
): MemoryRecallPackage {
  const { memorySummary, recallExplain } = buildMemoryRecallExplain(memories, locale);
  return {
    memories,
    memorySummary,
    recallExplain,
    context: {
      memoryThemes: extractMemoryThemes(memories),
      excludePoiNames: extractVisitedPoiNames(memories),
      boostPoiNames: extractBoostPoiNames(memories),
    },
  };
}

function rowToWallItem(row: typeof petMemories.$inferSelect): PetMemoryWallItem {
  const metadata = row.metadata ?? null;
  const pinned = metadata?.pinned === true;
  return {
    id: row.id,
    memoryType: row.memoryType,
    content: row.content,
    importance: row.importance,
    pinned,
    metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** H3-c：记忆墙分页（置顶优先） */
export async function listUserMemoriesPaginated(
  userId: number,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<PetMemoryWallItem>> {
  try {
    const db = getDb();
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(petMemories)
      .where(eq(petMemories.userId, userId));

    const rows = await db
      .select()
      .from(petMemories)
      .where(eq(petMemories.userId, userId))
      .orderBy(
        sql`CASE WHEN JSON_EXTRACT(${petMemories.metadata}, '$.pinned') = true THEN 0 ELSE 1 END`,
        desc(petMemories.importance),
        desc(petMemories.updatedAt),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return buildPaginatedResult(rows.map(rowToWallItem), Number(count) || 0, page, pageSize);
  } catch (err) {
    console.error('[pet-memory] list 失败:', err instanceof Error ? err.message : err);
    throw new ApiError(ApiMessageKey.PET_MEMORY_FETCH_FAILED);
  }
}

export async function deleteUserMemory(userId: number, memoryId: number): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: petMemories.id })
    .from(petMemories)
    .where(and(eq(petMemories.id, memoryId), eq(petMemories.userId, userId)))
    .limit(1);
  if (!rows[0]) {
    throw new ApiError(ApiMessageKey.PET_MEMORY_NOT_FOUND);
  }
  await db.delete(petMemories).where(eq(petMemories.id, memoryId));
}

export async function setUserMemoryPinned(
  userId: number,
  memoryId: number,
  pinned: boolean,
): Promise<PetMemoryWallItem> {
  const db = getDb();
  const rows = await db
    .select()
    .from(petMemories)
    .where(and(eq(petMemories.id, memoryId), eq(petMemories.userId, userId)))
    .limit(1);
  if (!rows[0]) {
    throw new ApiError(ApiMessageKey.PET_MEMORY_NOT_FOUND);
  }
  const metadata = { ...(rows[0].metadata ?? {}), pinned };
  await db.update(petMemories).set({ metadata }).where(eq(petMemories.id, memoryId));
  const updated = await db
    .select()
    .from(petMemories)
    .where(eq(petMemories.id, memoryId))
    .limit(1);
  return rowToWallItem(updated[0]!);
}

/** H3-c：用户确认写入 analyze 建议的记忆 */
export async function confirmSuggestedMemories(
  userId: number,
  items: PetSuggestedMemory[],
): Promise<number[]> {
  const ids: number[] = [];
  for (const item of items) {
    const content = item.content?.trim();
    if (!content) continue;
    const id = await writeTripMemory({
      userId,
      memoryType: (item.memoryType as PetMemoryTypeValue) || PetMemoryType.PREFERENCE,
      content,
      importance: item.importance,
      metadata: item.metadata,
    });
    if (id) ids.push(id);
  }
  return ids;
}
