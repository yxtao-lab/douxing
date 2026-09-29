import { and, count, desc, eq, inArray, like, sql } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  VERIFICATION_POINT_AMOUNTS,
  VerificationPointEventType,
  buildVerificationPointDedupeKey,
  computeCheckInVerificationAward,
  extractRouteKeyAttractionIds,
  resolveFollowCompleteThreshold,
  type CheckInVerificationAward,
  type PaginatedResult,
  type VerificationPointEventInfo,
  type VerificationPointsSummary,
  buildPaginatedResult,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { checkIns } from '../db/schema/check-ins.js';
import { verificationPointEvents } from '../db/schema/verification-point-events.js';
import { formatDbDateTimeForApi } from '../utils/api-datetime.js';

export interface CreditVerificationPointsInput {
  userId: number;
  eventType: string;
  points: number;
  dedupeKey: string;
  routeId?: number | null;
  checkInId?: number | null;
  attractionId?: number | null;
  meta?: Record<string, unknown> | null;
}

export interface CreditVerificationPointsResult {
  credited: boolean;
  points: number;
  balance: number;
  eventId: number | null;
}

/**
 * 将账本行映射为 API 结构。
 *
 * @param row - 账本行
 * @returns VerificationPointEventInfo
 */
function toEventInfo(row: typeof verificationPointEvents.$inferSelect): VerificationPointEventInfo {
  return {
    id: Number(row.id),
    userId: row.userId,
    eventType: row.eventType,
    points: row.points,
    balanceAfter: row.balanceAfter,
    routeId: row.routeId ?? null,
    checkInId: row.checkInId ?? null,
    attractionId: row.attractionId ?? null,
    meta: row.meta ?? null,
    createdAt: formatDbDateTimeForApi(row.createdAt),
  };
}

/**
 * 幂等入账验证积分：写入事件账本并更新用户余额。
 * 相同 dedupeKey 重复调用不重复加分。
 *
 * @param input - 入账参数
 * @returns 是否新入账、本次分值、最新余额
 */
export async function creditVerificationPoints(
  input: CreditVerificationPointsInput,
): Promise<CreditVerificationPointsResult> {
  const points = Math.trunc(Number(input.points) || 0);
  if (points === 0) {
    const balance = await getVerificationPointsBalance(input.userId);
    return { credited: false, points: 0, balance, eventId: null };
  }

  const db = getDb();
  const existing = await db
    .select({ id: verificationPointEvents.id, balanceAfter: verificationPointEvents.balanceAfter })
    .from(verificationPointEvents)
    .where(eq(verificationPointEvents.dedupeKey, input.dedupeKey))
    .limit(1);
  if (existing[0]) {
    return {
      credited: false,
      points: 0,
      balance: existing[0].balanceAfter,
      eventId: Number(existing[0].id),
    };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const userRows = await tx
        .select({ balance: users.verificationPoints })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      const current = Number(userRows[0]?.balance ?? 0);
      const balanceAfter = current + points;
      if (balanceAfter < 0) {
        throw new ApiError(ApiMessageKey.POINTS_REDEMPTION_INSUFFICIENT);
      }

      const [inserted] = await tx.insert(verificationPointEvents).values({
        userId: input.userId,
        eventType: input.eventType,
        points,
        balanceAfter,
        dedupeKey: input.dedupeKey,
        routeId: input.routeId ?? null,
        checkInId: input.checkInId ?? null,
        attractionId: input.attractionId ?? null,
        meta: input.meta ?? null,
      });

      await tx
        .update(users)
        .set({ verificationPoints: sql`${users.verificationPoints} + ${points}` })
        .where(eq(users.id, input.userId));

      const refreshed = await tx
        .select({ balance: users.verificationPoints })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      const realBalance = Number(refreshed[0]?.balance ?? balanceAfter);

      if (realBalance !== balanceAfter) {
        await tx
          .update(verificationPointEvents)
          .set({ balanceAfter: realBalance })
          .where(eq(verificationPointEvents.id, Number(inserted.insertId)));
      }

      return {
        credited: true,
        points,
        balance: realBalance,
        eventId: Number(inserted.insertId),
      };
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('uk_verification_point_events_dedupe') || message.includes('Duplicate')) {
      const again = await db
        .select({ id: verificationPointEvents.id, balanceAfter: verificationPointEvents.balanceAfter })
        .from(verificationPointEvents)
        .where(eq(verificationPointEvents.dedupeKey, input.dedupeKey))
        .limit(1);
      if (again[0]) {
        return {
          credited: false,
          points: 0,
          balance: again[0].balanceAfter,
          eventId: Number(again[0].id),
        };
      }
    }
    throw err;
  }
}

/**
 * 幂等扣减验证积分（points 传正数，账本写入负值）。
 * 余额不足时抛 ApiError。
 *
 * @param input - 扣减参数（points 为正的消耗量）
 * @returns 是否新扣减、本次分值（负）、最新余额
 * @throws {ApiError} POINTS_REDEMPTION_INSUFFICIENT
 */
export async function debitVerificationPoints(input: {
  userId: number;
  eventType: string;
  points: number;
  dedupeKey: string;
  meta?: Record<string, unknown> | null;
}): Promise<CreditVerificationPointsResult> {
  const spend = Math.abs(Math.trunc(Number(input.points) || 0));
  if (spend === 0) {
    const balance = await getVerificationPointsBalance(input.userId);
    return { credited: false, points: 0, balance, eventId: null };
  }

  const db = getDb();
  const existing = await db
    .select({ id: verificationPointEvents.id, balanceAfter: verificationPointEvents.balanceAfter })
    .from(verificationPointEvents)
    .where(eq(verificationPointEvents.dedupeKey, input.dedupeKey))
    .limit(1);
  if (existing[0]) {
    return {
      credited: false,
      points: 0,
      balance: existing[0].balanceAfter,
      eventId: Number(existing[0].id),
    };
  }

  const current = await getVerificationPointsBalance(input.userId);
  if (current < spend) {
    throw new ApiError(ApiMessageKey.POINTS_REDEMPTION_INSUFFICIENT);
  }

  return creditVerificationPoints({
    userId: input.userId,
    eventType: input.eventType,
    points: -spend,
    dedupeKey: input.dedupeKey,
    meta: input.meta ?? null,
  });
}

/**
 * 读取用户验证积分余额。
 *
 * @param userId - 用户 ID
 * @returns 余额；用户不存在时为 0
 */
export async function getVerificationPointsBalance(userId: number): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ balance: users.verificationPoints })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Number(rows[0]?.balance ?? 0);
}

/**
 * 分页列出用户验证积分账本（可审计）。
 *
 * @param userId - 用户 ID
 * @param page - 页码（从 1）
 * @param pageSize - 每页条数
 * @returns 余额 + 事件列表
 */
export async function listVerificationPointEvents(
  userId: number,
  page = 1,
  pageSize = 20,
): Promise<VerificationPointsSummary> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeSize = Math.min(50, Math.max(1, Math.floor(pageSize) || 20));
  const db = getDb();
  const balance = await getVerificationPointsBalance(userId);
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(verificationPointEvents)
    .where(eq(verificationPointEvents.userId, userId));
  const offset = (safePage - 1) * safeSize;
  const rows = await db
    .select()
    .from(verificationPointEvents)
    .where(eq(verificationPointEvents.userId, userId))
    .orderBy(desc(verificationPointEvents.createdAt), desc(verificationPointEvents.id))
    .limit(safeSize)
    .offset(offset);

  const pageResult: PaginatedResult<VerificationPointEventInfo> = buildPaginatedResult(
    rows.map(toEventInfo),
    Number(total),
    safePage,
    safeSize,
  );

  return {
    balance,
    events: pageResult.items,
    page: pageResult.page,
    pageSize: pageResult.pageSize,
    total: pageResult.total,
  };
}

/**
 * 灵感稿发布入账（低分）。
 *
 * @param userId - 作者
 * @param routeId - 路线 ID
 * @returns 入账结果
 */
export async function awardInspirationPublish(userId: number, routeId: number) {
  return creditVerificationPoints({
    userId,
    eventType: VerificationPointEventType.INSPIRATION_PUBLISH,
    points: VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.INSPIRATION_PUBLISH],
    dedupeKey: buildVerificationPointDedupeKey(
      VerificationPointEventType.INSPIRATION_PUBLISH,
      routeId,
    ),
    routeId,
    meta: { reason: 'inspiration_publish' },
  });
}

/**
 * 路线升级为可出行稿时给作者一次性高分结算。
 *
 * @param creatorId - 作者
 * @param routeId - 路线 ID
 * @returns 入账结果
 */
export async function awardTravelReadyUpgrade(creatorId: number, routeId: number) {
  return creditVerificationPoints({
    userId: creatorId,
    eventType: VerificationPointEventType.TRAVEL_READY_UPGRADE,
    points: VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.TRAVEL_READY_UPGRADE],
    dedupeKey: buildVerificationPointDedupeKey(
      VerificationPointEventType.TRAVEL_READY_UPGRADE,
      routeId,
    ),
    routeId,
    meta: { reason: 'travel_ready_upgrade' },
  });
}

/**
 * 纠错被采纳入账（U5 报错流可复用；U4 提供可审计入口）。
 *
 * @param userId - 贡献者
 * @param routeId - 路线 ID
 * @param reportKey - 报错/纠错唯一键（参与幂等）
 * @returns 入账结果
 */
export async function awardCorrectionAccepted(
  userId: number,
  routeId: number,
  reportKey: string,
) {
  const key = reportKey.trim() || 'default';
  return creditVerificationPoints({
    userId,
    eventType: VerificationPointEventType.CORRECTION_ACCEPTED,
    points: VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.CORRECTION_ACCEPTED],
    dedupeKey: buildVerificationPointDedupeKey(
      VerificationPointEventType.CORRECTION_ACCEPTED,
      routeId,
      key,
    ),
    routeId,
    meta: { reason: 'correction_accepted', reportKey: key },
  });
}

/**
 * 查询用户在某路线某 POI 是否已拿过打卡验证分（防同点刷）。
 *
 * @param userId - 用户
 * @param routeId - 路线
 * @param attractionId - 景点；无绑定时用 0
 * @returns 是否已入账
 */
export async function hasCheckInVerificationForPoi(
  userId: number,
  routeId: number,
  attractionId: number | null | undefined,
): Promise<boolean> {
  const poiKey = attractionId && attractionId > 0 ? attractionId : 0;
  const prefix = buildVerificationPointDedupeKey('checkin', userId, routeId, poiKey);
  const db = getDb();
  const rows = await db
    .select({ id: verificationPointEvents.id })
    .from(verificationPointEvents)
    .where(
      and(
        eq(verificationPointEvents.userId, userId),
        like(verificationPointEvents.dedupeKey, `${prefix}%`),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * 打卡成功后按规则入账验证分；同点仅首次有效。
 *
 * @param input.userId - 打卡用户
 * @param input.routeId - 路线
 * @param input.checkInId - 打卡记录
 * @param input.attractionId - 景点
 * @param input.isFirstAtAttraction - 是否全局首次该景点
 * @param input.hasPhotos - 是否带图
 * @param input.routeDetail - 用于判定关键节点
 * @returns 奖励拆解与入账合计
 */
export async function awardCheckInVerification(input: {
  userId: number;
  routeId: number;
  checkInId: number;
  attractionId?: number | null;
  isFirstAtAttraction: boolean;
  hasPhotos: boolean;
  routeDetail: unknown;
}): Promise<{ award: CheckInVerificationAward; creditedPoints: number }> {
  const attractionId = input.attractionId && input.attractionId > 0 ? input.attractionId : null;
  const poiKey = attractionId ?? 0;
  const alreadyAwarded = await hasCheckInVerificationForPoi(
    input.userId,
    input.routeId,
    attractionId,
  );
  const keyIds = extractRouteKeyAttractionIds(input.routeDetail);
  const isKeyNode = attractionId != null && keyIds.includes(attractionId);

  const award = computeCheckInVerificationAward({
    isFirstAtAttraction: input.isFirstAtAttraction,
    isKeyNode,
    hasPhotos: input.hasPhotos,
    alreadyAwardedForPoi: alreadyAwarded,
  });

  if (award.total <= 0 || award.parts.length === 0) {
    return { award, creditedPoints: 0 };
  }

  let creditedPoints = 0;
  for (const part of award.parts) {
    const result = await creditVerificationPoints({
      userId: input.userId,
      eventType: part.eventType,
      points: part.points,
      dedupeKey: buildVerificationPointDedupeKey(
        'checkin',
        input.userId,
        input.routeId,
        poiKey,
        part.eventType,
      ),
      routeId: input.routeId,
      checkInId: input.checkInId,
      attractionId,
      meta: {
        reasonKeys: award.reasonKeys,
        isKeyNode,
        isFirstAtAttraction: input.isFirstAtAttraction,
        hasPhotos: input.hasPhotos,
      },
    });
    if (result.credited) creditedPoints += result.points;
  }

  return { award, creditedPoints };
}

/**
 * 他人跟走完成关键节点后给路线作者高分（每对 author×follower×route 一次）。
 *
 * @param routeId - 被跟走路线
 * @param followerUserId - 跟走用户（不可是作者本人）
 * @returns 是否入账
 */
export async function maybeAwardFollowComplete(
  routeId: number,
  followerUserId: number,
): Promise<CreditVerificationPointsResult | null> {
  const db = getDb();
  const routes = await db.select().from(travelRoutes).where(eq(travelRoutes.id, routeId)).limit(1);
  const route = routes[0];
  if (!route) return null;
  if (route.creatorId === followerUserId) return null;

  const keyIds = extractRouteKeyAttractionIds(route.routeDetail);
  const threshold = resolveFollowCompleteThreshold(keyIds.length);
  if (threshold <= 0) return null;

  const checkInRows = await db
    .select({ attractionId: checkIns.attractionId })
    .from(checkIns)
    .where(
      and(
        eq(checkIns.routeId, routeId),
        eq(checkIns.userId, followerUserId),
        inArray(checkIns.attractionId, keyIds),
      ),
    );
  const hit = new Set(
    checkInRows
      .map((row) => row.attractionId)
      .filter((id): id is number => typeof id === 'number' && id > 0),
  );
  if (hit.size < threshold) return null;

  return creditVerificationPoints({
    userId: route.creatorId,
    eventType: VerificationPointEventType.FOLLOW_COMPLETE,
    points: VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.FOLLOW_COMPLETE],
    dedupeKey: buildVerificationPointDedupeKey(
      VerificationPointEventType.FOLLOW_COMPLETE,
      routeId,
      followerUserId,
    ),
    routeId,
    meta: {
      reason: 'follow_complete',
      followerUserId,
      keyNodesHit: hit.size,
      threshold,
    },
  });
}

/**
 * 安全触发跟走奖励，失败只打日志。
 *
 * @param routeId - 路线
 * @param followerUserId - 跟走用户
 */
export async function maybeAwardFollowCompleteSafe(
  routeId: number,
  followerUserId: number,
): Promise<void> {
  try {
    await maybeAwardFollowComplete(routeId, followerUserId);
  } catch (err) {
    console.warn(
      '[verification-points] follow_complete 失败',
      routeId,
      followerUserId,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * 统计时间窗内用户验证积分入账合计（排行榜 POINTS 指标）。
 *
 * @param periodStart - 起始
 * @param periodEnd - 结束
 * @returns userId → 积分
 */
export async function sumVerificationPointsByUserInRange(
  periodStart: Date,
  periodEnd: Date,
): Promise<Map<number, number>> {
  const db = getDb();
  const rows = await db
    .select({
      userId: verificationPointEvents.userId,
      totalPoints: sql<number>`coalesce(sum(${verificationPointEvents.points}), 0)`,
    })
    .from(verificationPointEvents)
    .where(
      and(
        sql`${verificationPointEvents.createdAt} >= ${periodStart}`,
        sql`${verificationPointEvents.createdAt} <= ${periodEnd}`,
      ),
    )
    .groupBy(verificationPointEvents.userId);

  const map = new Map<number, number>();
  for (const row of rows) {
    map.set(row.userId, Number(row.totalPoints));
  }
  return map;
}
