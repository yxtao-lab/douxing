import { eq, desc, and, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { routeComments } from '../db/schema/route-comments.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { users } from '../db/schema/users.js';
import { RouteStatus } from '@douxing/shared';
import type { RouteCommentInfo } from '@douxing/shared';

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

export async function listRouteComments(routeId: number, limit = 50): Promise<RouteCommentInfo[]> {
  const db = getDb();
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  const rows = await db
    .select({
      id: routeComments.id,
      routeId: routeComments.routeId,
      userId: routeComments.userId,
      content: routeComments.content,
      createdAt: routeComments.createdAt,
      userNickname: users.nickname,
      userAvatar: users.avatar,
    })
    .from(routeComments)
    .innerJoin(users, eq(routeComments.userId, users.id))
    .where(eq(routeComments.routeId, routeId))
    .orderBy(desc(routeComments.createdAt))
    .limit(safeLimit);

  return rows.map((r) => ({
    id: r.id,
    routeId: r.routeId,
    userId: r.userId,
    userNickname: r.userNickname,
    userAvatar: r.userAvatar,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createRouteComment(routeId: number, userId: number, content: string) {
  const route = await canCommentOnRoute(routeId);
  if (!route) return null;

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('评论内容不能为空');
  }

  const db = getDb();
  const [result] = await db.insert(routeComments).values({
    routeId,
    userId,
    content: trimmed.slice(0, 500),
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

  return {
    id: row.id,
    routeId: row.routeId,
    userId: row.userId,
    userNickname: row.userNickname,
    userAvatar: row.userAvatar,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  } satisfies RouteCommentInfo;
}
