import { eq, desc, and, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { routeComments } from '../db/schema/route-comments.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { users } from '../db/schema/users.js';
import { RouteStatus, ApiError, ApiMessageKey } from '@douxing/shared';
import type { RouteCommentInfo } from '@douxing/shared';
import { rewritePublicAssetUrl } from '../utils/public-asset-url.util.js';

/** 路线评论列表查询选项（H10-a 支持按天/POI 筛选） */
export interface ListRouteCommentsOptions {
  limit?: number;
  dayIndex?: number;
  attractionId?: number;
}

/** 发表路线评论时的 POI 上下文（均可选，兼容旧客户端） */
export interface CreateRouteCommentInput {
  content: string;
  dayIndex?: number;
  attractionId?: number;
  poiName?: string;
}

/**
 * 判断路线是否允许评论（广场公开已发布路线）。
 *
 * @param routeId - 路线 ID
 * @returns 可评论的路线行；不可评论时为 `null`
 */
async function canCommentOnRoute(routeId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(travelRoutes)
    .where(
      and(
        eq(travelRoutes.id, routeId),
        eq(travelRoutes.status, RouteStatus.PUBLISHED),
        eq(travelRoutes.isPublic, 1),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 将评论行映射为 API 响应结构。
 *
 * @param row - 联表查询结果
 * @returns 前端可用的评论信息
 */
function toRouteCommentInfo(row: {
  id: number;
  routeId: number;
  userId: number;
  content: string;
  dayIndex: number | null;
  attractionId: number | null;
  poiName: string | null;
  createdAt: Date;
  userNickname: string;
  userAvatar: string | null;
}): RouteCommentInfo {
  return {
    id: row.id,
    routeId: row.routeId,
    userId: row.userId,
    userNickname: row.userNickname,
    userAvatar: rewritePublicAssetUrl(row.userAvatar),
    content: row.content,
    dayIndex: row.dayIndex,
    attractionId: row.attractionId,
    poiName: row.poiName,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 列出路线评论，支持按行程天或景点筛选。
 *
 * @param routeId - 路线 ID
 * @param options - 分页与筛选；`dayIndex` / `attractionId` 可同时传入以缩小范围
 * @returns 评论列表，按创建时间倒序
 */
export async function listRouteComments(
  routeId: number,
  options: ListRouteCommentsOptions = {},
): Promise<RouteCommentInfo[]> {
  const db = getDb();
  const safeLimit = Math.min(Math.max(options.limit ?? 50, 1), 100);

  const conditions = [eq(routeComments.routeId, routeId)];
  if (options.attractionId != null && Number.isFinite(options.attractionId)) {
    conditions.push(eq(routeComments.attractionId, options.attractionId));
  }
  if (options.dayIndex != null && Number.isFinite(options.dayIndex)) {
    conditions.push(eq(routeComments.dayIndex, options.dayIndex));
  }

  const rows = await db
    .select({
      id: routeComments.id,
      routeId: routeComments.routeId,
      userId: routeComments.userId,
      content: routeComments.content,
      dayIndex: routeComments.dayIndex,
      attractionId: routeComments.attractionId,
      poiName: routeComments.poiName,
      createdAt: routeComments.createdAt,
      userNickname: users.nickname,
      userAvatar: users.avatar,
    })
    .from(routeComments)
    .innerJoin(users, eq(routeComments.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(routeComments.createdAt))
    .limit(safeLimit);

  return rows.map(toRouteCommentInfo);
}

/**
 * 在广场公开路线上发表评论，可附带 POI 上下文。
 *
 * @param routeId - 路线 ID
 * @param userId - 评论用户 ID
 * @param input - 评论正文与可选 POI 关联
 * @returns 新评论；路线不可评论时为 `null`
 * @throws {ApiError} 内容为空时抛出 `ROUTE_COMMENT_EMPTY`
 */
export async function createRouteComment(
  routeId: number,
  userId: number,
  input: CreateRouteCommentInput | string,
) {
  const route = await canCommentOnRoute(routeId);
  if (!route) return null;

  const payload: CreateRouteCommentInput =
    typeof input === 'string' ? { content: input } : input;

  const trimmed = payload.content.trim();
  if (!trimmed) {
    throw new ApiError(ApiMessageKey.ROUTE_COMMENT_EMPTY);
  }

  const dayIndex =
    payload.dayIndex != null && Number.isFinite(payload.dayIndex)
      ? Math.max(0, Math.min(29, Math.floor(payload.dayIndex)))
      : null;
  const attractionId =
    payload.attractionId != null && Number.isFinite(payload.attractionId) && payload.attractionId > 0
      ? Math.floor(payload.attractionId)
      : null;
  const poiName = payload.poiName?.trim().slice(0, 128) || null;

  const db = getDb();
  const [result] = await db.insert(routeComments).values({
    routeId,
    userId,
    content: trimmed.slice(0, 500),
    dayIndex,
    attractionId,
    poiName,
  });

  await db
    .update(travelRoutes)
    .set({ commentCount: sql`${travelRoutes.commentCount} + 1` })
    .where(eq(travelRoutes.id, routeId));

  const commentId = Number(result.insertId);
  const rows = await db
    .select({
      id: routeComments.id,
      routeId: routeComments.routeId,
      userId: routeComments.userId,
      content: routeComments.content,
      dayIndex: routeComments.dayIndex,
      attractionId: routeComments.attractionId,
      poiName: routeComments.poiName,
      createdAt: routeComments.createdAt,
      userNickname: users.nickname,
      userAvatar: users.avatar,
    })
    .from(routeComments)
    .innerJoin(users, eq(routeComments.userId, users.id))
    .where(eq(routeComments.id, commentId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return toRouteCommentInfo(row);
}
