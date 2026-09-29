/**
 * A-COGNITION-02：行程复盘「计划 vs 实际」diff（纯函数，禁止散落魔法数）。
 */

/** 复盘状态 */
export const TripFeedbackStatus = {
  DRAFT: 'draft',
  FINALIZED: 'finalized',
} as const;

export type TripFeedbackStatusValue =
  (typeof TripFeedbackStatus)[keyof typeof TripFeedbackStatus];

/** 计划 POI 节点（复盘用精简结构） */
export interface TripFeedbackPlannedPoi {
  name: string;
  dayIndex: number;
  attractionId?: number | null;
  time?: string | null;
}

/** 已访问 / 跳过条目 */
export interface TripFeedbackPoiItem {
  name: string;
  dayIndex: number;
  attractionId?: number | null;
  /** visited | skipped */
  status: 'visited' | 'skipped';
}

/** 评价摘要 */
export interface TripFeedbackRatingSummary {
  commentCount: number;
  ratedCount: number;
  averageRating: number | null;
  reviewTags: string[];
}

/** 复盘 diff 计算结果 */
export interface TripFeedbackDiff {
  plannedCount: number;
  visitedCount: number;
  skippedCount: number;
  visited: TripFeedbackPoiItem[];
  skipped: TripFeedbackPoiItem[];
  completionRate: number;
  rating: TripFeedbackRatingSummary;
  summaryText: string;
}

/** Golden Case 分桶载荷（训练 / 召回） */
export interface TripFeedbackGoldenPayload {
  source: 'trip_feedback';
  routeId: number;
  userId: number;
  cityHint: string | null;
  plannedPois: string[];
  visitedPois: string[];
  skippedPois: string[];
  averageRating: number | null;
  reviewTags: string[];
  ageRange: string | null;
  preferredScenes: string[];
  summaryText: string;
}

/**
 * 从路线 days 提取可复盘玩点（排除住宿/交通）。
 *
 * @param days - 行程天列表（宽松结构）
 * @returns 计划 POI
 */
export function extractPlannedPoisForFeedback(days: unknown): TripFeedbackPlannedPoi[] {
  if (!Array.isArray(days)) return [];
  const result: TripFeedbackPlannedPoi[] = [];
  days.forEach((day, dayIndex) => {
    if (!day || typeof day !== 'object') return;
    const attractions = (day as { attractions?: unknown }).attractions;
    if (!Array.isArray(attractions)) return;
    for (const spot of attractions) {
      if (!spot || typeof spot !== 'object') continue;
      const row = spot as {
        name?: unknown;
        attractionId?: unknown;
        time?: unknown;
        poiType?: unknown;
      };
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (!name) continue;
      const poiType = typeof row.poiType === 'string' ? row.poiType : 'attraction';
      if (poiType === 'hotel' || poiType === 'transport') continue;
      result.push({
        name,
        dayIndex,
        attractionId:
          typeof row.attractionId === 'number' && row.attractionId > 0
            ? row.attractionId
            : null,
        time: typeof row.time === 'string' ? row.time : null,
      });
    }
  });
  return result;
}

/**
 * 判断名称是否模糊命中（包含关系）。
 *
 * @param plannedName - 计划名
 * @param visitedNames - 已访问名
 * @returns 是否命中
 */
function nameMatched(plannedName: string, visitedNames: string[]): boolean {
  const target = plannedName.trim().toLowerCase();
  if (!target) return false;
  return visitedNames.some((name) => {
    const n = name.trim().toLowerCase();
    if (!n) return false;
    return n === target || n.includes(target) || target.includes(n);
  });
}

/**
 * 由已分类的去过/跳过列表组装复盘 diff（含评价摘要）。
 *
 * @param input.visited - 已到访
 * @param input.skipped - 跳过
 * @param input.ratings - 评论评分列表（1～5）
 * @param input.reviewTags - 评价标签并集
 * @param input.commentCount - 评论条数
 * @returns diff
 */
export function assembleTripFeedbackDiff(input: {
  visited: TripFeedbackPoiItem[];
  skipped: TripFeedbackPoiItem[];
  ratings: number[];
  reviewTags: string[];
  commentCount: number;
}): TripFeedbackDiff {
  const visited = input.visited.map((item) => ({ ...item, status: 'visited' as const }));
  const skipped = input.skipped.map((item) => ({ ...item, status: 'skipped' as const }));
  const plannedCount = visited.length + skipped.length;
  const visitedCount = visited.length;
  const skippedCount = skipped.length;
  const completionRate =
    plannedCount > 0 ? Math.round((visitedCount / plannedCount) * 100) / 100 : 0;

  const validRatings = input.ratings.filter(
    (r) => Number.isFinite(r) && r >= 1 && r <= 5,
  );
  const averageRating =
    validRatings.length > 0
      ? Math.round(
          (validRatings.reduce((a, b) => a + b, 0) / validRatings.length) * 10,
        ) / 10
      : null;

  const tagSet = new Set(input.reviewTags.map((t) => t.trim()).filter(Boolean));
  const rating: TripFeedbackRatingSummary = {
    commentCount: Math.max(0, Math.floor(input.commentCount || 0)),
    ratedCount: validRatings.length,
    averageRating,
    reviewTags: [...tagSet].slice(0, 12),
  };

  const summaryParts = [
    `计划 ${plannedCount} 点，实到 ${visitedCount}，跳过 ${skippedCount}（完成率 ${Math.round(completionRate * 100)}%）`,
  ];
  if (visited.length > 0) {
    summaryParts.push(`去过：${visited.map((v) => v.name).slice(0, 8).join('、')}`);
  }
  if (skipped.length > 0) {
    summaryParts.push(`跳过：${skipped.map((v) => v.name).slice(0, 8).join('、')}`);
  }
  if (averageRating != null) {
    summaryParts.push(`评价均分 ${averageRating}`);
  }
  if (rating.reviewTags.length > 0) {
    summaryParts.push(`标签：${rating.reviewTags.slice(0, 6).join('、')}`);
  }

  return {
    plannedCount,
    visitedCount,
    skippedCount,
    visited,
    skipped,
    completionRate,
    rating,
    summaryText: summaryParts.join('；'),
  };
}

/**
 * 计算行程复盘 diff（按景点 ID / 名称模糊匹配，供纯函数验收与无 GPS 场景）。
 *
 * @param input.planned - 计划 POI
 * @param input.visitedAttractionIds - 打卡绑定景点 ID
 * @param input.visitedNames - 打卡地名
 * @param input.ratings - 评论评分列表（1～5）
 * @param input.reviewTags - 评价标签并集
 * @param input.commentCount - 评论条数
 * @returns diff
 */
export function computeTripFeedbackDiff(input: {
  planned: TripFeedbackPlannedPoi[];
  visitedAttractionIds: number[];
  visitedNames: string[];
  ratings: number[];
  reviewTags: string[];
  commentCount: number;
}): TripFeedbackDiff {
  const visitedIdSet = new Set(
    input.visitedAttractionIds.filter((id) => Number.isFinite(id) && id > 0),
  );
  const visitedNames = input.visitedNames
    .map((n) => n.trim())
    .filter(Boolean);

  const visited: TripFeedbackPoiItem[] = [];
  const skipped: TripFeedbackPoiItem[] = [];

  for (const poi of input.planned) {
    const byId =
      poi.attractionId != null && visitedIdSet.has(poi.attractionId);
    const byName = nameMatched(poi.name, visitedNames);
    const item: TripFeedbackPoiItem = {
      name: poi.name,
      dayIndex: poi.dayIndex,
      attractionId: poi.attractionId ?? null,
      status: byId || byName ? 'visited' : 'skipped',
    };
    if (item.status === 'visited') visited.push(item);
    else skipped.push(item);
  }

  return assembleTripFeedbackDiff({
    visited,
    skipped,
    ratings: input.ratings,
    reviewTags: input.reviewTags,
    commentCount: input.commentCount,
  });
}

/** 行程复盘 API 视图 */
export interface TripFeedbackInfo {
  id: number | null;
  routeId: number;
  userId: number;
  status: TripFeedbackStatusValue;
  diff: TripFeedbackDiff;
  goldenPayload: TripFeedbackGoldenPayload | null;
  memoryIds: number[];
  finalizedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * 组装 Golden Case / 训练分桶载荷。
 *
 * @param input - 复盘与画像桶字段
 * @returns 载荷
 */
export function buildTripFeedbackGoldenPayload(input: {
  routeId: number;
  userId: number;
  cityHint: string | null;
  diff: TripFeedbackDiff;
  ageRange: string | null;
  preferredScenes: string[];
}): TripFeedbackGoldenPayload {
  return {
    source: 'trip_feedback',
    routeId: input.routeId,
    userId: input.userId,
    cityHint: input.cityHint,
    plannedPois: [
      ...input.diff.visited.map((p) => p.name),
      ...input.diff.skipped.map((p) => p.name),
    ],
    visitedPois: input.diff.visited.map((p) => p.name),
    skippedPois: input.diff.skipped.map((p) => p.name),
    averageRating: input.diff.rating.averageRating,
    reviewTags: input.diff.rating.reviewTags,
    ageRange: input.ageRange,
    preferredScenes: [...input.preferredScenes],
    summaryText: input.diff.summaryText,
  };
}
