/**
 * Phase 4：规划前注入用户画像（兴趣标签 + H3 记忆）
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import type { TravelIntentSnapshot } from '@douxing/shared';
import {
  extractBoostPoiNames,
  extractMemoryThemes,
  extractVisitedPoiNames,
  recallUserMemory,
} from './pet-memory.service.js';

export interface PlanUserContext {
  interestTags: string[];
  memoryThemes: string[];
  excludePoiNames: string[];
  boostPoiNames: string[];
}

export async function loadPlanUserContext(userId: number): Promise<PlanUserContext> {
  const db = getDb();
  const rows = await db
    .select({ interestTags: users.interestTags })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const interestTags = rows[0]?.interestTags ?? [];

  const memories = await recallUserMemory(userId, { limit: 12 });
  const memoryThemes = extractMemoryThemes(memories);
  const excludePoiNames = extractVisitedPoiNames(memories);
  const boostPoiNames = extractBoostPoiNames(memories);

  return {
    interestTags,
    memoryThemes,
    excludePoiNames,
    boostPoiNames,
  };
}

export function mergeIntentWithUserContext(
  intent: TravelIntentSnapshot,
  context: PlanUserContext,
): TravelIntentSnapshot {
  const themes = [
    ...new Set([
      ...intent.themes,
      ...context.interestTags,
      ...context.memoryThemes,
    ]),
  ];
  return {
    ...intent,
    themes,
  };
}

/** C7-c：将 memory_agent 召回摘要写入 intent.constraintSummary */
export function applyMemoryContextToIntent(
  intent: TravelIntentSnapshot,
  context: PlanUserContext,
  memorySummary?: string,
): TravelIntentSnapshot {
  let merged = mergeIntentWithUserContext(intent, context);
  const summary = memorySummary?.trim();
  if (summary) {
    const existing = merged.constraintSummary?.trim();
    merged = {
      ...merged,
      constraintSummary: existing ? `${existing}；${summary}` : summary,
    };
  }
  return merged;
}
