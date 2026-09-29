/**
 * A-COGNITION-02：行程复盘回流（计划 vs 实际 → 记忆 / Golden Case）
 */
import { and, desc, eq } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  TripFeedbackStatus,
  assembleTripFeedbackDiff,
  buildTripFeedbackGoldenPayload,
  extractPlannedPoisForFeedback,
  type LocaleCode,
  type RouteDayAttraction,
  type RouteDetailPayload,
  type TripFeedbackGoldenPayload,
  type TripFeedbackInfo,
  type TripFeedbackPoiItem,
  type TripFeedbackStatusValue,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { tripFeedbacks } from '../db/schema/trip-feedbacks.js';
import { users } from '../db/schema/users.js';
import { formatDbDateTimeForApi } from '../utils/api-datetime.js';
import { listRouteCheckInsPaginated } from './checkin.service.js';
import {
  buildVisitMatchContext,
  isPlannedPoiVisited,
} from './missed-poi.service.js';
import {
  PetMemoryType,
  recallUserMemory,
  writeTripMemory,
} from './pet-memory.service.js';
import { listRouteComments } from './route-comment.service.js';
import { getRouteById } from './route.service.js';
import { refreshUserPersona } from './travel-persona.service.js';

/**
 * 校验路线归属并返回路线实体。
 *
 * @param routeId - 路线 ID
 * @param userId - 当前用户
 * @returns 路线
 * @throws {ApiError} 不存在或非本人
 */
async function assertRouteOwner(routeId: number, userId: number) {
  const route = await getRouteById(routeId, userId, { recordView: false });
  if (!route) {
    throw new ApiError(ApiMessageKey.ROUTE_NOT_FOUND);
  }
  if (route.creatorId !== userId) {
    throw new ApiError(ApiMessageKey.ROUTE_FORBIDDEN);
  }
  return route;
}

/**
 * 从路线详情解析城市提示。
 *
 * @param routeName - 路线名
 * @param detail - routeDetail
 * @returns 城市或 null
 */
function resolveCityHint(
  routeName: string,
  detail: RouteDetailPayload | null | undefined,
): string | null {
  const matched =
    typeof detail?.matchedCity === 'string' ? detail.matchedCity.trim() : '';
  if (matched) return matched;
  const haystack = [
    routeName,
    detail?.sourcePrompt ?? '',
    detail?.days?.[0]?.title ?? '',
  ].join(' ');
  for (const city of ['杭州', '成都', '重庆', '上海', '北京', '西安', '厦门', '丽江']) {
    if (haystack.includes(city)) return city;
  }
  return null;
}

/**
 * 将数据库行转为 API 视图。
 *
 * @param row - 复盘行
 * @returns TripFeedbackInfo
 */
function toTripFeedbackInfo(
  row: typeof tripFeedbacks.$inferSelect,
): TripFeedbackInfo {
  const visited = Array.isArray(row.visitedJson) ? row.visitedJson : [];
  const skipped = Array.isArray(row.skippedJson) ? row.skippedJson : [];
  const rating = row.ratingSummaryJson;
  const completionRate = Number(row.completionRate);
  return {
    id: row.id,
    routeId: row.routeId,
    userId: row.userId,
    status: row.status as TripFeedbackStatusValue,
    diff: {
      plannedCount: row.plannedCount,
      visitedCount: row.visitedCount,
      skippedCount: row.skippedCount,
      visited,
      skipped,
      completionRate: Number.isFinite(completionRate) ? completionRate : 0,
      rating,
      summaryText: row.summaryText,
    },
    goldenPayload: row.goldenPayloadJson ?? null,
    memoryIds: Array.isArray(row.memoryIdsJson) ? row.memoryIdsJson : [],
    finalizedAt: row.finalizedAt ? formatDbDateTimeForApi(row.finalizedAt) : null,
    createdAt: formatDbDateTimeForApi(row.createdAt),
    updatedAt: formatDbDateTimeForApi(row.updatedAt),
  };
}

/**
 * 计算单条路线的计划 vs 实际 diff（不落库）。
 *
 * @param routeId - 路线 ID
 * @param userId - 用户 ID
 * @returns 预览信息（id 为空、status=draft）
 * @throws {ApiError} 路线不存在/无权限/无有效节点
 */
export async function previewTripFeedback(
  routeId: number,
  userId: number,
): Promise<TripFeedbackInfo> {
  const { info } = await buildTripFeedbackDraft(routeId, userId);
  return info;
}

/**
 * 读取已落库的行程复盘；无记录时返回 null。
 *
 * @param routeId - 路线 ID
 * @param userId - 用户 ID
 * @returns 复盘或 null
 * @throws {ApiError} 路线不存在/无权限
 */
export async function getTripFeedback(
  routeId: number,
  userId: number,
): Promise<TripFeedbackInfo | null> {
  await assertRouteOwner(routeId, userId);
  const db = getDb();
  const rows = await db
    .select()
    .from(tripFeedbacks)
    .where(
      and(eq(tripFeedbacks.routeId, routeId), eq(tripFeedbacks.userId, userId)),
    )
    .limit(1);
  return rows[0] ? toTripFeedbackInfo(rows[0]) : null;
}

/**
 * 构建复盘草稿（含 golden 载荷），不写库。
 *
 * @param routeId - 路线 ID
 * @param userId - 用户 ID
 * @returns 草稿视图与内部载荷
 * @throws {ApiError} 路线不存在/无权限/无有效节点
 */
async function buildTripFeedbackDraft(
  routeId: number,
  userId: number,
): Promise<{
  info: TripFeedbackInfo;
  goldenPayload: TripFeedbackGoldenPayload;
}> {
  const route = await assertRouteOwner(routeId, userId);
  const detail = route.routeDetail as RouteDetailPayload | null | undefined;
  const days = detail?.days;
  if (!days || days.length === 0) {
    throw new ApiError(ApiMessageKey.ROUTE_NO_VALID_NODES);
  }

  const planned = extractPlannedPoisForFeedback(days);
  if (planned.length === 0) {
    throw new ApiError(ApiMessageKey.ROUTE_NO_VALID_NODES);
  }

  const checkins = await listRouteCheckInsPaginated(routeId, userId, 1, 200);
  const visitCtx = buildVisitMatchContext(checkins.items);

  const visited: TripFeedbackPoiItem[] = [];
  const skipped: TripFeedbackPoiItem[] = [];
  for (const poi of planned) {
    const spot: RouteDayAttraction = {
      name: poi.name,
      attractionId: poi.attractionId ?? undefined,
      time: poi.time ?? '',
      cost: 0,
      description: '',
      poiType: 'attraction',
    };
    const hit = isPlannedPoiVisited(spot, visitCtx);
    const item: TripFeedbackPoiItem = {
      name: poi.name,
      dayIndex: poi.dayIndex,
      attractionId: poi.attractionId ?? null,
      status: hit ? 'visited' : 'skipped',
    };
    if (hit) visited.push(item);
    else skipped.push(item);
  }

  const comments = await listRouteComments(routeId, {
    limit: 100,
    viewerUserId: userId,
  });
  const ownComments = comments.filter((c) => c.userId === userId);
  const ratings = ownComments
    .map((c) => c.rating)
    .filter((r): r is number => typeof r === 'number' && r >= 1 && r <= 5);
  const reviewTags = ownComments.flatMap((c) =>
    Array.isArray(c.reviewTags) ? c.reviewTags : [],
  );

  const diff = assembleTripFeedbackDiff({
    visited,
    skipped,
    ratings,
    reviewTags,
    commentCount: ownComments.length,
  });

  const db = getDb();
  const userRows = await db
    .select({
      ageRange: users.ageRange,
      preferredScenes: users.preferredScenes,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const ageRange = userRows[0]?.ageRange ?? null;
  const preferredScenes = userRows[0]?.preferredScenes ?? [];

  const goldenPayload = buildTripFeedbackGoldenPayload({
    routeId,
    userId,
    cityHint: resolveCityHint(route.name, detail),
    diff,
    ageRange,
    preferredScenes,
  });

  return {
    info: {
      id: null,
      routeId,
      userId,
      status: TripFeedbackStatus.DRAFT,
      diff,
      goldenPayload,
      memoryIds: [],
      finalizedAt: null,
      createdAt: null,
      updatedAt: null,
    },
    goldenPayload,
  };
}

/**
 * 写入 visited / regret / trip_summary 记忆（幂等：同 route+poi 跳过重复）。
 *
 * @param input - 用户、路线、diff、语言
 * @returns 新写入的 memory id 列表
 */
async function writeFeedbackMemories(input: {
  userId: number;
  routeId: number;
  visited: TripFeedbackPoiItem[];
  skipped: TripFeedbackPoiItem[];
  summaryText: string;
  locale: LocaleCode;
}): Promise<number[]> {
  const existing = await recallUserMemory(input.userId, { limit: 20 });
  const existingKeys = new Set<string>();
  for (const m of existing) {
    const metaRouteId = m.metadata?.routeId;
    const poiName = m.metadata?.poiName;
    const source = m.metadata?.source;
    if (metaRouteId === input.routeId && typeof poiName === 'string') {
      existingKeys.add(`${m.memoryType}:${poiName.trim()}`);
    }
    if (
      metaRouteId === input.routeId &&
      source === 'a_cognition_02' &&
      m.memoryType === PetMemoryType.TRIP_SUMMARY
    ) {
      existingKeys.add('trip_summary');
    }
  }

  const memoryIds: number[] = [];
  const visitedLabel =
    input.locale === 'en-US' ? 'Visited' : '已到访';
  const skippedLabel =
    input.locale === 'en-US'
      ? 'Planned but skipped'
      : '计划前往但未打卡/跳过';

  for (const poi of input.visited.slice(0, 20)) {
    const key = `${PetMemoryType.VISITED}:${poi.name}`;
    if (existingKeys.has(key)) continue;
    const id = await writeTripMemory({
      userId: input.userId,
      memoryType: PetMemoryType.VISITED,
      content: `${visitedLabel}：${poi.name}`,
      importance: 6,
      metadata: {
        poiName: poi.name,
        routeId: input.routeId,
        dayIndex: poi.dayIndex,
        attractionId: poi.attractionId,
        source: 'a_cognition_02',
      },
    });
    if (id) {
      memoryIds.push(id);
      existingKeys.add(key);
    }
  }

  for (const poi of input.skipped.slice(0, 20)) {
    const key = `${PetMemoryType.REGRET}:${poi.name}`;
    if (existingKeys.has(key)) continue;
    const id = await writeTripMemory({
      userId: input.userId,
      memoryType: PetMemoryType.REGRET,
      content: `${skippedLabel}：${poi.name}`,
      importance: 8,
      metadata: {
        poiName: poi.name,
        routeId: input.routeId,
        dayIndex: poi.dayIndex,
        attractionId: poi.attractionId,
        source: 'a_cognition_02',
      },
    });
    if (id) {
      memoryIds.push(id);
      existingKeys.add(key);
    }
  }

  if (!existingKeys.has('trip_summary')) {
    const id = await writeTripMemory({
      userId: input.userId,
      memoryType: PetMemoryType.TRIP_SUMMARY,
      content: input.summaryText,
      importance: 7,
      metadata: {
        routeId: input.routeId,
        source: 'a_cognition_02',
      },
    });
    if (id) memoryIds.push(id);
  }

  return memoryIds;
}

/**
 * 确认行程复盘：落库 Golden 载荷、写记忆、刷新画像。
 *
 * @param routeId - 路线 ID
 * @param userId - 用户 ID
 * @param locale - 文案语言
 * @returns 已确认的复盘
 * @throws {ApiError} 已确认 / 路线无权 / 无节点
 */
export async function finalizeTripFeedback(
  routeId: number,
  userId: number,
  locale: LocaleCode = 'zh-CN',
): Promise<TripFeedbackInfo> {
  const existing = await getTripFeedback(routeId, userId);
  if (existing?.status === TripFeedbackStatus.FINALIZED) {
    throw new ApiError(ApiMessageKey.TRIP_FEEDBACK_ALREADY_FINALIZED);
  }

  const { info, goldenPayload } = await buildTripFeedbackDraft(routeId, userId);
  const memoryIds = await writeFeedbackMemories({
    userId,
    routeId,
    visited: info.diff.visited,
    skipped: info.diff.skipped,
    summaryText: info.diff.summaryText,
    locale,
  });

  try {
    await refreshUserPersona(userId);
  } catch (err) {
    console.warn(
      '[trip-feedback] 刷新画像失败（不影响复盘落库）:',
      err instanceof Error ? err.message : err,
    );
  }

  const db = getDb();
  const now = new Date();
  const values = {
    userId,
    routeId,
    status: TripFeedbackStatus.FINALIZED as TripFeedbackStatusValue,
    plannedCount: info.diff.plannedCount,
    visitedCount: info.diff.visitedCount,
    skippedCount: info.diff.skippedCount,
    completionRate: String(info.diff.completionRate),
    visitedJson: info.diff.visited,
    skippedJson: info.diff.skipped,
    ratingSummaryJson: info.diff.rating,
    summaryText: info.diff.summaryText,
    goldenPayloadJson: goldenPayload,
    memoryIdsJson: memoryIds,
    finalizedAt: now,
  };

  if (existing?.id != null) {
    await db
      .update(tripFeedbacks)
      .set(values)
      .where(eq(tripFeedbacks.id, existing.id));
    const rows = await db
      .select()
      .from(tripFeedbacks)
      .where(eq(tripFeedbacks.id, existing.id))
      .limit(1);
    return toTripFeedbackInfo(rows[0]!);
  }

  const [inserted] = await db.insert(tripFeedbacks).values(values);
  const id = Number(inserted.insertId);
  const rows = await db
    .select()
    .from(tripFeedbacks)
    .where(eq(tripFeedbacks.id, id))
    .limit(1);
  return toTripFeedbackInfo(rows[0]!);
}

/**
 * 召回用户最近已确认复盘摘要（供规划注入）。
 *
 * @param userId - 用户 ID
 * @param limit - 最多条数（默认 3）
 * @returns 摘要字符串列表
 */
export async function recallRecentTripFeedbackSummaries(
  userId: number,
  limit = 3,
): Promise<string[]> {
  try {
    const db = getDb();
    const safeLimit = Math.min(Math.max(limit, 1), 8);
    const rows = await db
      .select({
        summaryText: tripFeedbacks.summaryText,
        goldenPayloadJson: tripFeedbacks.goldenPayloadJson,
      })
      .from(tripFeedbacks)
      .where(
        and(
          eq(tripFeedbacks.userId, userId),
          eq(tripFeedbacks.status, TripFeedbackStatus.FINALIZED),
        ),
      )
      .orderBy(desc(tripFeedbacks.finalizedAt), desc(tripFeedbacks.id))
      .limit(safeLimit);

    return rows
      .map((row) => {
        const city =
          row.goldenPayloadJson &&
          typeof row.goldenPayloadJson.cityHint === 'string'
            ? row.goldenPayloadJson.cityHint
            : null;
        const prefix = city ? `【${city}复盘】` : '【行程复盘】';
        return `${prefix}${row.summaryText}`;
      })
      .filter((s) => s.length > 0);
  } catch (err) {
    console.warn(
      '[trip-feedback] 召回失败，跳过:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
