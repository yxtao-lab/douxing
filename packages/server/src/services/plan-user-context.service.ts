/**
 * Phase 4：规划前注入用户画像（兴趣标签 + H3 记忆 + 旅行人格）
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
import { getPersonaSummaryForPlanning } from './travel-persona.service.js';
import { recallRecentTripFeedbackSummaries } from './trip-feedback.service.js';

export interface PlanUserContext {
  interestTags: string[];
  /** P-ONBOARD-01 / P-TAG-01：用户偏好场景 */
  preferredScenes: string[];
  memoryThemes: string[];
  excludePoiNames: string[];
  boostPoiNames: string[];
  /** A-COGNITION-01：旅行画像摘要 */
  personaSummary: string | null;
  /** A-COGNITION-02：最近行程复盘摘要（供规划召回） */
  tripFeedbackSummaries: string[];
}

/**
 * 加载规划用用户上下文（兴趣、场景偏好、记忆、画像摘要、复盘回流）。
 *
 * @param userId - 用户 ID
 * @returns PlanUserContext；无数据时字段为空数组或 null
 */
export async function loadPlanUserContext(userId: number): Promise<PlanUserContext> {
  const db = getDb();
  const rows = await db
    .select({
      interestTags: users.interestTags,
      preferredScenes: users.preferredScenes,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const interestTags = rows[0]?.interestTags ?? [];
  const preferredScenes = rows[0]?.preferredScenes ?? [];

  const memories = await recallUserMemory(userId, { limit: 12 });
  const memoryThemes = extractMemoryThemes(memories);
  const excludePoiNames = extractVisitedPoiNames(memories);
  const boostPoiNames = extractBoostPoiNames(memories);

  const personaSummary = await getPersonaSummaryForPlanning(userId);
  const tripFeedbackSummaries = await recallRecentTripFeedbackSummaries(userId, 3);

  return {
    interestTags,
    preferredScenes,
    memoryThemes,
    excludePoiNames,
    boostPoiNames,
    personaSummary,
    tripFeedbackSummaries,
  };
}

/**
 * 将用户上下文合并进意图：兴趣进 themes；偏好场景仅写入约束摘要作软偏好，
 * **不**并入 sceneTags，避免把「常逛场景」写进路线归属导致专题广场串类。
 *
 * @param intent - 当前规划意图
 * @param context - 用户上下文
 * @returns 合并后的意图快照
 */
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
  const preferredScenesHint =
    context.preferredScenes.length > 0
      ? `用户常逛场景偏好（软参考，勿强制归类）：${context.preferredScenes.join('、')}`
      : '';
  const existingSummary = intent.constraintSummary?.trim();
  const constraintSummary = [existingSummary, preferredScenesHint].filter(Boolean).join('；') || null;
  return {
    ...intent,
    themes,
    sceneTags: [...new Set(intent.sceneTags ?? [])],
    constraintSummary,
  };
}

/**
 * 将旅行画像摘要注入 intent.constraintSummary（非 Agent 路径使用）。
 *
 * @param intent - 当前规划意图
 * @param context - 用户上下文（含 personaSummary）
 * @returns 注入画像摘要后的意图
 */
export function injectPersonaSummary(
  intent: TravelIntentSnapshot,
  context: PlanUserContext,
): TravelIntentSnapshot {
  const personaSummary = context.personaSummary?.trim();
  if (!personaSummary) return intent;
  const existing = intent.constraintSummary?.trim();
  return {
    ...intent,
    constraintSummary: existing ? `${existing}；${personaSummary}` : personaSummary,
  };
}

/**
 * 将行程复盘摘要注入 intent.constraintSummary。
 *
 * @param intent - 当前规划意图
 * @param context - 用户上下文
 * @returns 注入后的意图
 */
export function injectTripFeedbackSummary(
  intent: TravelIntentSnapshot,
  context: PlanUserContext,
): TravelIntentSnapshot {
  const feedback =
    context.tripFeedbackSummaries?.filter((s) => s.trim()).join('；') ?? '';
  if (!feedback) return intent;
  const existing = intent.constraintSummary?.trim();
  return {
    ...intent,
    constraintSummary: existing ? `${existing}；${feedback}` : feedback,
  };
}

/** C7-c：将 memory_agent 召回摘要 + 旅行画像 + 复盘回流写入 intent.constraintSummary */
export function applyMemoryContextToIntent(
  intent: TravelIntentSnapshot,
  context: PlanUserContext,
  memorySummary?: string,
): TravelIntentSnapshot {
  let merged = mergeIntentWithUserContext(intent, context);
  const summaryParts: string[] = [];
  const existingSummary = merged.constraintSummary?.trim();
  if (existingSummary) summaryParts.push(existingSummary);
  if (context.personaSummary?.trim()) summaryParts.push(context.personaSummary.trim());
  if (memorySummary?.trim()) summaryParts.push(memorySummary.trim());
  const feedback =
    context.tripFeedbackSummaries?.filter((s) => s.trim()).join('；') ?? '';
  if (feedback) summaryParts.push(feedback);
  if (summaryParts.length > 0) {
    merged = {
      ...merged,
      constraintSummary: summaryParts.join('；'),
    };
  }
  return merged;
}
