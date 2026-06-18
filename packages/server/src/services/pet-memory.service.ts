/**
 * Phase 4：H3 宠物记忆读写
 */
import { desc, eq, and } from 'drizzle-orm';
import { TRAVEL_PET_DEFAULT_NICKNAME } from '@douxing/shared';
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
