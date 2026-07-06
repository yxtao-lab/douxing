import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { routeComments } from '../db/schema/route-comments.js';
import { routeCommentLikes } from '../db/schema/route-comment-likes.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { users } from '../db/schema/users.js';
import { RouteStatus, ApiError, ApiMessageKey } from '@douxing/shared';
import type { RouteCommentInfo, RouteCommentLikeResult } from '@douxing/shared';
import { rewritePublicAssetUrl } from '../utils/public-asset-url.util.js';

/** 路线评论列表查询选项（H10-a 筛选 + H10-d 排序） */
export interface ListRouteCommentsOptions {
  limit?: number;
  dayIndex?: number;
  attractionId?: number;
  sort?: 'hot' | 'recent';
  /** 当前登录用户，用于填充 `isLiked` */
  viewerUserId?: number;
}

/** 发表路线评论时的 POI 上下文（均可选，兼容旧客户端） */
export interface CreateRouteCommentInput {
  content: string;
  dayIndex?: number;
  attractionId?: number;
  poiName?: string;
}

type CommentRow = {
  id: number;
  routeId: number;
  userId: number;
  content: string;
  dayIndex: number | null;
  attractionId: number | null;
  poiName: string | null;
  likeCount: number;
  isFeatured: number;
  createdAt: Date;
  userNickname: string;
  userAvatar: string | null;
};

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
 * 判断用户是否可查看/互动该路线（公开或本人）。
 *
 * @param routeId - 路线 ID
 * @param userId - 用户 ID
 * @returns 路线行或 `null`
 */
async function getViewableRoute(routeId: number, userId: number) {
  const db = getDb();
  const rows = await db.select().from(travelRoutes).where(eq(travelRoutes.id, routeId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.creatorId === userId) return row;
  if (row.status === RouteStatus.PUBLISHED && row.isPublic === 1) return row;
  return null;
}

/**
 * 批量查询用户对评论的点赞状态。
 *
 * @param userId - 用户 ID
 * @param commentIds - 评论 ID 列表
 * @returns 已点赞的评论 ID 集合
 */
async function loadLikedCommentIds(userId: number, commentIds: number[]): Promise<Set<number>> {
  if (commentIds.length === 0) return new Set();
  const db = getDb();
  const rows = await db
    .select({ commentId: routeCommentLikes.commentId })
    .from(routeCommentLikes)
    .where(
      and(eq(routeCommentLikes.userId, userId), inArray(routeCommentLikes.commentId, commentIds)),
    );
  return new Set(rows.map((r) => r.commentId));
}

/**
 * 将评论行映射为 API 响应结构。
 *
 * @param row - 联表查询结果
 * @param likedIds - 当前用户已点赞的评论 ID 集合
 * @returns 前端可用的评论信息
 */
function toRouteCommentInfo(row: CommentRow, likedIds?: Set<number>): RouteCommentInfo {
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
    likeCount: row.likeCount ?? 0,
    isFeatured: row.isFeatured === 1,
    isLiked: likedIds ? likedIds.has(row.id) : undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 列出路线评论，支持按行程天/POI 筛选与 H10-d 热门排序。
 *
 * @param routeId - 路线 ID
 * @param options - 分页、筛选、排序与 viewerUserId
 * @returns 评论列表
 */
export async function listRouteComments(
  routeId: number,
  options: ListRouteCommentsOptions = {},
): Promise<RouteCommentInfo[]> {
  const db = getDb();
  const safeLimit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const sort = options.sort === 'hot' ? 'hot' : 'recent';

  const conditions = [eq(routeComments.routeId, routeId)];
  if (options.attractionId != null && Number.isFinite(options.attractionId)) {
    conditions.push(eq(routeComments.attractionId, options.attractionId));
  }
  if (options.dayIndex != null && Number.isFinite(options.dayIndex)) {
    conditions.push(eq(routeComments.dayIndex, options.dayIndex));
  }

  const orderBy =
    sort === 'hot'
      ? [
          desc(routeComments.isFeatured),
          desc(routeComments.likeCount),
          desc(routeComments.createdAt),
        ]
      : [desc(routeComments.createdAt)];

  const rows = await db
    .select({
      id: routeComments.id,
      routeId: routeComments.routeId,
      userId: routeComments.userId,
      content: routeComments.content,
      dayIndex: routeComments.dayIndex,
      attractionId: routeComments.attractionId,
      poiName: routeComments.poiName,
      likeCount: routeComments.likeCount,
      isFeatured: routeComments.isFeatured,
      createdAt: routeComments.createdAt,
      userNickname: users.nickname,
      userAvatar: users.avatar,
    })
    .from(routeComments)
    .innerJoin(users, eq(routeComments.userId, users.id))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(safeLimit);

  const likedIds =
    options.viewerUserId != null
      ? await loadLikedCommentIds(
          options.viewerUserId,
          rows.map((r) => r.id),
        )
      : undefined;

  return rows.map((row) => toRouteCommentInfo(row, likedIds));
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
      likeCount: routeComments.likeCount,
      isFeatured: routeComments.isFeatured,
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

  return toRouteCommentInfo(row, new Set());
}

/**
 * 切换评论点赞状态（H10-d）。
 *
 * @param routeId - 路线 ID
 * @param commentId - 评论 ID
 * @param userId - 操作用户 ID
 * @returns 点赞结果；路线或评论不可访问时为 `null`
 */
export async function toggleRouteCommentLike(
  routeId: number,
  commentId: number,
  userId: number,
): Promise<RouteCommentLikeResult | null> {
  const route = await getViewableRoute(routeId, userId);
  if (!route) return null;

  const db = getDb();
  const commentRows = await db
    .select()
    .from(routeComments)
    .where(and(eq(routeComments.id, commentId), eq(routeComments.routeId, routeId)))
    .limit(1);
  if (!commentRows[0]) return null;

  const existing = await db
    .select()
    .from(routeCommentLikes)
    .where(and(eq(routeCommentLikes.userId, userId), eq(routeCommentLikes.commentId, commentId)))
    .limit(1);

  if (existing[0]) {
    await db
      .delete(routeCommentLikes)
      .where(and(eq(routeCommentLikes.userId, userId), eq(routeCommentLikes.commentId, commentId)));
    await db
      .update(routeComments)
      .set({ likeCount: sql`GREATEST(${routeComments.likeCount} - 1, 0)` })
      .where(eq(routeComments.id, commentId));
    const updated = await db
      .select({ likeCount: routeComments.likeCount })
      .from(routeComments)
      .where(eq(routeComments.id, commentId))
      .limit(1);
    return { liked: false, likeCount: updated[0]?.likeCount ?? 0 };
  }

  await db.insert(routeCommentLikes).values({ userId, commentId });
  await db
    .update(routeComments)
    .set({ likeCount: sql`${routeComments.likeCount} + 1` })
    .where(eq(routeComments.id, commentId));
  const updated = await db
    .select({ likeCount: routeComments.likeCount })
    .from(routeComments)
    .where(eq(routeComments.id, commentId))
    .limit(1);
  return { liked: true, likeCount: updated[0]?.likeCount ?? 0 };
}

/**
 * 设置评论精选状态（H10-d 运营位）；仅管理员调用。
 *
 * @param routeId - 路线 ID
 * @param commentId - 评论 ID
 * @param featured - 是否精选
 * @returns 更新后的评论；不存在时为 `null`
 */
export async function setRouteCommentFeatured(
  routeId: number,
  commentId: number,
  featured: boolean,
): Promise<RouteCommentInfo | null> {
  const db = getDb();
  const existing = await db
    .select()
    .from(routeComments)
    .where(and(eq(routeComments.id, commentId), eq(routeComments.routeId, routeId)))
    .limit(1);
  if (!existing[0]) return null;

  await db
    .update(routeComments)
    .set({ isFeatured: featured ? 1 : 0 })
    .where(eq(routeComments.id, commentId));

  const rows = await db
    .select({
      id: routeComments.id,
      routeId: routeComments.routeId,
      userId: routeComments.userId,
      content: routeComments.content,
      dayIndex: routeComments.dayIndex,
      attractionId: routeComments.attractionId,
      poiName: routeComments.poiName,
      likeCount: routeComments.likeCount,
      isFeatured: routeComments.isFeatured,
      createdAt: routeComments.createdAt,
      userNickname: users.nickname,
      userAvatar: users.avatar,
    })
    .from(routeComments)
    .innerJoin(users, eq(routeComments.userId, users.id))
    .where(eq(routeComments.id, commentId))
    .limit(1);

  const row = rows[0];
  return row ? toRouteCommentInfo(row) : null;
}
