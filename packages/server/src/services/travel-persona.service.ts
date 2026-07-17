/**
 * 统一用户旅行画像聚合 Service（A-COGNITION-01）
 *
 * 聚合数据源：
 * - users.interestTags（兴趣标签）
 * - pet_memories（记忆主题、忌讳/避开）
 * - travel_routes（天数、预算、目的地、POI 类型）
 * - check_ins（城市偏好、打卡频率、拍照习惯）
 * - journey_albums / travel_photos（拍照热情）
 *
 * 派生字段：
 * - rhythm（旅行节奏）
 * - budgetTier（预算档次）
 * - budgetFlexibility（预算弹性）
 * - companionStructure（同伴结构）
 * - travelStyle（旅行风格标签）
 * - summary（人类可读摘要，供 LLM 注入）
 */
import { eq, sql, and } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { checkIns } from '../db/schema/check-ins.js';
import { travelPhotos } from '../db/schema/journey-albums.js';
import { userTravelPersona } from '../db/schema/user-travel-persona.js';
import {
  type PersonaRhythm,
  type PersonaBudgetTier,
  type PersonaBudgetFlexibility,
  type PersonaPhotoEnthusiasm,
  type TravelPersonaSnapshot,
} from '@douxing/shared';
import {
  PetMemoryType,
  recallUserMemory,
  type RecalledMemory,
} from './pet-memory.service.js';

/** 兴趣标签到同伴结构的映射 */
const FAMILY_TAGS = ['亲子'];
const GROUP_TAGS = ['户外'];

/**
 * 解析预算范围字符串为每日预算中值。
 *
 * @param budgetRange - 预算范围字符串，如 "3000-8000"
 * @param days - 路线天数
 * @returns 每日预算中值；无法解析时返回 `null`
 */
function parseDailyBudget(budgetRange: string | null, days: number): number | null {
  if (!budgetRange) return null;
  const parts = budgetRange.split('-').map((s) => s.trim());
  let min: number;
  let max: number;
  if (parts.length === 2 && parts[0] && parts[1]) {
    min = Number(parts[0]);
    max = Number(parts[1]);
  } else if (parts.length === 1 && parts[0]) {
    min = Number(parts[0]);
    max = Number(parts[0]);
  } else {
    return null;
  }
  if (Number.isNaN(min) || Number.isNaN(max) || days <= 0) return null;
  return (min + max) / 2 / days;
}

/**
 * 根据每日预算中值推断预算档次。
 *
 * @param dailyBudgets - 每日预算中值数组
 * @returns 预算档次
 */
function deriveBudgetTier(dailyBudgets: number[]): PersonaBudgetTier {
  if (dailyBudgets.length === 0) return 'mid-range';
  const avg = dailyBudgets.reduce((a, b) => a + b, 0) / dailyBudgets.length;
  if (avg < 2000) return 'budget';
  if (avg > 5000) return 'premium';
  return 'mid-range';
}

/**
 * 根据预算范围宽度推断预算弹性。
 *
 * @param budgetRanges - 预算范围字符串数组
 * @returns 预算弹性
 */
function deriveBudgetFlexibility(budgetRanges: string[]): PersonaBudgetFlexibility {
  if (budgetRanges.length === 0) return 'flexible';
  let flexibleCount = 0;
  for (const range of budgetRanges) {
    const parts = range.split('-').map((s) => s.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      const min = Number(parts[0]);
      const max = Number(parts[1]);
      if (!Number.isNaN(min) && !Number.isNaN(max) && min > 0) {
        const ratio = (max - min) / min;
        if (ratio > 0.5) flexibleCount++;
      }
    }
  }
  return flexibleCount > budgetRanges.length / 2 ? 'flexible' : 'fixed';
}

/**
 * 根据平均天数和打卡密度推断旅行节奏。
 *
 * @param avgDays - 平均路线天数
 * @param checkinDensity - 每日打卡次数
 * @returns 旅行节奏
 */
function deriveRhythm(avgDays: number, checkinDensity: number): PersonaRhythm {
  if (avgDays <= 0) return 'balanced';
  if (avgDays >= 5 && checkinDensity < 2) return 'relaxed';
  if (avgDays <= 2 || checkinDensity >= 4) return 'intensive';
  return 'balanced';
}

/**
 * 根据兴趣标签推断同伴结构。
 *
 * @param interestTags - 用户兴趣标签数组
 * @returns 同伴结构标签数组
 */
function deriveCompanionStructure(interestTags: string[]): string[] {
  const companions = new Set<string>();
  const hasFamily = interestTags.some((t) => FAMILY_TAGS.includes(t));
  const hasGroup = interestTags.some((t) => GROUP_TAGS.includes(t));
  if (hasFamily) companions.add('family');
  if (hasGroup) companions.add('group');
  if (companions.size === 0) companions.add('solo');
  return [...companions];
}

/**
 * 根据兴趣标签和节奏推断旅行风格标签。
 *
 * @param interestTags - 兴趣标签
 * @param rhythm - 旅行节奏
 * @param hasFamily - 是否亲子
 * @returns 旅行风格中文标签
 */
function deriveTravelStyle(
  interestTags: string[],
  rhythm: PersonaRhythm,
  hasFamily: boolean,
): string {
  const tags = new Set(interestTags);
  if (hasFamily) {
    return rhythm === 'relaxed' ? '亲子休闲型' : '亲子探索型';
  }
  if (tags.has('文化') || tags.has('历史')) return '文化探索型';
  if (tags.has('摄影') || tags.has('自然')) return '自然摄影型';
  if (tags.has('美食')) return '美食漫游型';
  if (tags.has('户外')) return '户外探险型';
  if (rhythm === 'intensive') return '高效打卡型';
  return '休闲漫游型';
}

/**
 * 从行程天数列表中提取 POI 类型分布。
 *
 * @param routeDetails - 路线 routeDetail JSON 数组
 * @returns POI 名称到出现次数的映射
 */
function extractPoiTypesFromRoutes(
  routeDetails: Record<string, unknown>[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const detail of routeDetails) {
    const days = (detail.days as Array<{ attractions?: Array<{ poiType?: string }> }> | undefined) ?? [];
    for (const day of days) {
      for (const attr of day.attractions ?? []) {
        const type = attr.poiType;
        if (type) counts.set(type, (counts.get(type) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/**
 * 构建人类可读的画像摘要，供 LLM 规划注入。
 *
 * @param persona - 画像数据
 * @returns 摘要文本
 */
function buildPersonaSummary(data: {
  travelStyle: string;
  rhythm: PersonaRhythm;
  budgetTier: PersonaBudgetTier;
  topDestinations: string[];
  interestTags: string[];
  memoryThemes: string[];
  avoidList: string[];
  companionStructure: string[];
}): string {
  const parts: string[] = [];
  parts.push(`旅行风格：${data.travelStyle}`);
  const companionLabels: Record<string, string> = {
    solo: '独行',
    couple: '结伴',
    family: '亲子',
    group: '团体',
  };
  const companions = data.companionStructure.map((c) => companionLabels[c] ?? c).join('、');
  if (companions) parts.push(`同伴结构：${companions}`);
  if (data.topDestinations.length > 0) {
    parts.push(`偏好目的地：${data.topDestinations.slice(0, 5).join('、')}`);
  }
  if (data.interestTags.length > 0) {
    parts.push(`兴趣标签：${data.interestTags.join('、')}`);
  }
  if (data.memoryThemes.length > 0) {
    parts.push(`记忆偏好：${data.memoryThemes.slice(0, 6).join('、')}`);
  }
  if (data.avoidList.length > 0) {
    parts.push(`希望避开：${data.avoidList.slice(0, 6).join('、')}`);
  }
  return parts.join('；');
}

/**
 * 聚合所有数据源，构建用户旅行画像。
 *
 * @param userId - 用户 ID
 * @returns 画像快照（未持久化）
 */
export async function buildUserPersona(
  userId: number,
): Promise<Omit<TravelPersonaSnapshot, 'updatedAt'>> {
  const db = getDb();

  // 1. 用户兴趣标签
  const userRows = await db
    .select({ interestTags: users.interestTags })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const interestTags = userRows[0]?.interestTags ?? [];

  // 2. 宠物记忆
  const memories = await recallUserMemory(userId, { limit: 20 });
  const memoryThemes = extractPreferenceThemes(memories);
  const avoidList = extractAvoidList(memories);

  // 3. 历史路线
  const routeRows = await db
    .select({
      days: travelRoutes.days,
      budgetRange: travelRoutes.budgetRange,
      routeDetail: travelRoutes.routeDetail,
    })
    .from(travelRoutes)
    .where(eq(travelRoutes.creatorId, userId));
  const routeCount = routeRows.length;
  const dailyBudgets: number[] = [];
  const budgetRanges: string[] = [];
  const destinationCounts = new Map<string, number>();
  const poiTypeCounts = new Map<string, number>();
  let totalDays = 0;

  for (const row of routeRows) {
    totalDays += row.days;
    budgetRanges.push(row.budgetRange);
    const daily = parseDailyBudget(row.budgetRange, row.days);
    if (daily !== null) dailyBudgets.push(daily);
    const detail = row.routeDetail as Record<string, unknown> | null;
    if (detail) {
      const city = detail.matchedCity as string | undefined;
      if (city) destinationCounts.set(city, (destinationCounts.get(city) ?? 0) + 1);
      const routePoiTypes = extractPoiTypesFromRoutes([detail]);
      for (const [type, count] of routePoiTypes) {
        poiTypeCounts.set(type, (poiTypeCounts.get(type) ?? 0) + count);
      }
    }
  }
  const avgDays = routeCount > 0 ? totalDays / routeCount : 0;

  // 4. 打卡数据
  const checkinCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(checkIns)
    .where(eq(checkIns.userId, userId));
  const checkinCount = Number(checkinCountRows[0]?.count ?? 0);

  const checkinCityRows = await db
    .select({
      cityCode: checkIns.cityCode,
      count: sql<number>`count(*)`,
    })
    .from(checkIns)
    .where(eq(checkIns.userId, userId))
    .groupBy(checkIns.cityCode);
  for (const row of checkinCityRows) {
    destinationCounts.set(row.cityCode, (destinationCounts.get(row.cityCode) ?? 0) + Number(row.count));
  }

  const checkinDensity = totalDays > 0 ? checkinCount / totalDays : 0;

  // 5. 相册照片
  const photoCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(travelPhotos)
    .where(eq(travelPhotos.userId, userId));
  const photoCount = Number(photoCountRows[0]?.count ?? 0);

  // 派生字段
  const rhythm = deriveRhythm(avgDays, checkinDensity);
  const budgetTier = deriveBudgetTier(dailyBudgets);
  const budgetFlexibility = deriveBudgetFlexibility(budgetRanges);
  const companionStructure = deriveCompanionStructure(interestTags);
  const hasFamily = companionStructure.includes('family');

  // Top 目的地（按频率排序，最多 5 个）
  const topDestinations = [...destinationCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([city]) => city);

  // Top POI 类型（按频率排序，最多 5 个）
  const topPoiTypes = [...poiTypeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type]) => type);

  // 拍照热情
  let photoEnthusiasm: PersonaPhotoEnthusiasm = 'low';
  if (photoCount >= 50) photoEnthusiasm = 'high';
  else if (photoCount >= 10) photoEnthusiasm = 'medium';

  // 旅行风格
  const travelStyle = deriveTravelStyle(interestTags, rhythm, hasFamily);

  // 画像摘要
  const summary = buildPersonaSummary({
    travelStyle,
    rhythm,
    budgetTier,
    topDestinations,
    interestTags,
    memoryThemes,
    avoidList,
    companionStructure,
  });

  return {
    userId,
    personaVersion: 1,
    travelStyle,
    rhythm,
    budgetTier,
    budgetFlexibility,
    companionStructure,
    topDestinations,
    topPoiTypes,
    interestTags,
    memoryThemes,
    avoidList,
    photoEnthusiasm,
    routeCount,
    checkinCount,
    photoCount,
    summary,
  };
}

/**
 * 从偏好记忆中提取主题关键词。
 *
 * @param memories - 召回的记忆列表
 * @returns 主题关键词数组
 */
function extractPreferenceThemes(memories: RecalledMemory[]): string[] {
  const themes = new Set<string>();
  for (const m of memories) {
    if (m.memoryType === PetMemoryType.PREFERENCE) {
      for (const part of m.content.split(/[，,、]/)) {
        const t = part.trim();
        if (t) themes.add(t);
      }
    }
  }
  return [...themes].slice(0, 12);
}

/**
 * 从遗憾和已访记忆中提取避开列表。
 *
 * @param memories - 召回的记忆列表
 * @returns 避开项数组
 */
function extractAvoidList(memories: RecalledMemory[]): string[] {
  const avoid = new Set<string>();
  for (const m of memories) {
    if (m.memoryType === PetMemoryType.REGRET) {
      const metaName = m.metadata?.poiName;
      if (typeof metaName === 'string' && metaName.trim()) {
        avoid.add(metaName.trim());
      }
    }
  }
  return [...avoid].slice(0, 12);
}

/**
 * 将画像数据转换为数据库行格式。
 *
 * @param persona - 画像数据
 * @returns 数据库插入/更新值
 */
function toDbValues(persona: Omit<TravelPersonaSnapshot, 'updatedAt'>) {
  return {
    userId: persona.userId,
    travelStyle: persona.travelStyle,
    rhythm: persona.rhythm,
    budgetTier: persona.budgetTier,
    budgetFlexibility: persona.budgetFlexibility,
    companionStructure: persona.companionStructure,
    topDestinations: persona.topDestinations,
    topPoiTypes: persona.topPoiTypes,
    interestTags: persona.interestTags,
    memoryThemes: persona.memoryThemes,
    avoidList: persona.avoidList,
    photoEnthusiasm: persona.photoEnthusiasm,
    routeCount: persona.routeCount,
    checkinCount: persona.checkinCount,
    photoCount: persona.photoCount,
    summary: persona.summary,
  };
}

/**
 * 将数据库行转换为画像快照。
 *
 * @param row - 数据库行
 * @returns 画像快照
 */
function toSnapshot(row: typeof userTravelPersona.$inferSelect): TravelPersonaSnapshot {
  return {
    userId: row.userId,
    personaVersion: row.personaVersion,
    travelStyle: row.travelStyle,
    rhythm: row.rhythm as PersonaRhythm,
    budgetTier: row.budgetTier as PersonaBudgetTier,
    budgetFlexibility: row.budgetFlexibility as PersonaBudgetFlexibility,
    companionStructure: row.companionStructure,
    topDestinations: row.topDestinations,
    topPoiTypes: row.topPoiTypes,
    interestTags: row.interestTags,
    memoryThemes: row.memoryThemes,
    avoidList: row.avoidList,
    photoEnthusiasm: row.photoEnthusiasm as PersonaPhotoEnthusiasm,
    routeCount: row.routeCount,
    checkinCount: row.checkinCount,
    photoCount: row.photoCount,
    summary: row.summary,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 获取用户画像（读缓存，不存在时自动构建）。
 *
 * @param userId - 用户 ID
 * @returns 画像快照；用户不存在时返回 `null`
 */
export async function getUserPersona(userId: number): Promise<TravelPersonaSnapshot | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(userTravelPersona)
    .where(eq(userTravelPersona.userId, userId))
    .limit(1);
  if (rows[0]) return toSnapshot(rows[0]);

  // 用户是否存在
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRows[0]) return null;

  const persona = await buildUserPersona(userId);
  await db.insert(userTravelPersona).values({ ...toDbValues(persona) });
  return { ...persona, updatedAt: new Date().toISOString() };
}

/**
 * 强制刷新用户画像（重新聚合所有数据源）。
 *
 * @param userId - 用户 ID
 * @returns 刷新后的画像快照；用户不存在时返回 `null`
 */
export async function refreshUserPersona(userId: number): Promise<TravelPersonaSnapshot | null> {
  const db = getDb();
  const persona = await buildUserPersona(userId);

  const existing = await db
    .select({ id: userTravelPersona.id, personaVersion: userTravelPersona.personaVersion })
    .from(userTravelPersona)
    .where(eq(userTravelPersona.userId, userId))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(userTravelPersona)
      .set({
        ...toDbValues(persona),
        personaVersion: existing[0].personaVersion + 1,
      })
      .where(eq(userTravelPersona.id, existing[0].id));
    const rows = await db
      .select()
      .from(userTravelPersona)
      .where(eq(userTravelPersona.id, existing[0].id))
      .limit(1);
    if (rows[0]) return toSnapshot(rows[0]);
  } else {
    await db.insert(userTravelPersona).values({ ...toDbValues(persona) });
    const rows = await db
      .select()
      .from(userTravelPersona)
      .where(eq(userTravelPersona.userId, userId))
      .limit(1);
    if (rows[0]) return toSnapshot(rows[0]);
  }
  return null;
}

/**
 * 获取画像摘要文本，供 AI 规划注入。
 *
 * @param userId - 用户 ID
 * @returns 画像摘要文本；无画像时返回 `null`
 */
export async function getPersonaSummaryForPlanning(userId: number): Promise<string | null> {
  const persona = await getUserPersona(userId);
  return persona?.summary ?? null;
}
