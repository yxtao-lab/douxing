import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { routeLikes } from '../db/schema/route-likes.js';
import { routeFavorites } from '../db/schema/route-favorites.js';
import { users } from '../db/schema/users.js';
import { RouteStatus } from '@douxing/shared';
import type { RouteListQuery, TravelRouteInfo } from '@douxing/shared';
import { toRouteInfo } from '../utils/route-info.util.js';
import { rewritePublicAssetUrl } from '../utils/public-asset-url.util.js';

export async function enrichRoutesWithUserFlags(
  routes: TravelRouteInfo[],
  userId: number,
): Promise<TravelRouteInfo[]> {
  if (routes.length === 0) return routes;
  const db = getDb();
  const ids = routes.map((r) => r.id);

  const likedRows = await db
    .select({ routeId: routeLikes.routeId })
    .from(routeLikes)
    .where(and(eq(routeLikes.userId, userId), inArray(routeLikes.routeId, ids)));

  const favoritedRows = await db
    .select({ routeId: routeFavorites.routeId })
    .from(routeFavorites)
    .where(and(eq(routeFavorites.userId, userId), inArray(routeFavorites.routeId, ids)));

  const likedSet = new Set(likedRows.map((r) => r.routeId));
  const favoritedSet = new Set(favoritedRows.map((r) => r.routeId));

  return routes.map((r) => ({
    ...r,
    isLiked: likedSet.has(r.id),
    isFavorited: favoritedSet.has(r.id),
  }));
}

export async function enrichRoutesWithCreatorInfo(
  routes: TravelRouteInfo[],
): Promise<TravelRouteInfo[]> {
  if (routes.length === 0) return routes;
  const db = getDb();
  const creatorIds = [...new Set(routes.map((r) => r.creatorId))];
  const userRows = await db
    .select({ id: users.id, nickname: users.nickname, avatar: users.avatar })
    .from(users)
    .where(inArray(users.id, creatorIds));
  const map = new Map(userRows.map((u) => [u.id, u]));

  return routes.map((r) => {
    const creator = map.get(r.creatorId);
    return {
      ...r,
      creatorNickname: creator?.nickname ?? null,
      creatorAvatar: rewritePublicAssetUrl(creator?.avatar ?? null),
    };
  });
}

function resolveOrderBy(sort: RouteListQuery['sort'], scope: RouteListQuery['scope']) {
  if (sort === 'views') return desc(travelRoutes.viewCount);
  if (sort === 'hot' || scope === 'hot' || scope === 'plaza') {
    return desc(
      sql`${travelRoutes.likeCount} * 2 + ${travelRoutes.viewCount} + ${travelRoutes.commentCount}`,
    );
  }
  return desc(travelRoutes.createdAt);
}

function mapRowsForViewer(rows: typeof travelRoutes.$inferSelect[], viewerId: number) {
  return rows.map((row) => toRouteInfo(row, { viewerId }));
}

async function finalizeRouteList(routes: TravelRouteInfo[], userId: number, withCreator: boolean) {
  let result = await enrichRoutesWithUserFlags(routes, userId);
  if (withCreator) {
    result = await enrichRoutesWithCreatorInfo(result);
  }
  return result;
}

export async function listRoutesForUser(userId: number, query: RouteListQuery = {}) {
  const db = getDb();
  const scope = query.scope ?? 'mine';
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const orderBy = resolveOrderBy(query.sort, scope);

  if (scope === 'plaza' || scope === 'hot') {
    const rows = await db
      .select()
      .from(travelRoutes)
      .where(
        and(eq(travelRoutes.status, RouteStatus.PUBLISHED), eq(travelRoutes.isPublic, 1)),
      )
      .orderBy(orderBy)
      .limit(limit);
    const routes = mapRowsForViewer(rows, userId);
    return finalizeRouteList(routes, userId, true);
  }

  if (scope === 'favorites') {
    const rows = await db
      .select({ route: travelRoutes })
      .from(routeFavorites)
      .innerJoin(travelRoutes, eq(routeFavorites.routeId, travelRoutes.id))
      .where(eq(routeFavorites.userId, userId))
      .orderBy(desc(routeFavorites.createdAt))
      .limit(limit);
    const routes = rows.map((r) => toRouteInfo(r.route, { viewerId: userId }));
    return finalizeRouteList(routes, userId, true);
  }

  const conditions = [eq(travelRoutes.creatorId, userId)];
  if (query.status !== undefined && !Number.isNaN(query.status)) {
    conditions.push(eq(travelRoutes.status, query.status));
  }

  const rows = await db
    .select()
    .from(travelRoutes)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit);

  const routes = mapRowsForViewer(rows, userId);
  return finalizeRouteList(routes, userId, false);
}

export async function incrementRouteViewCount(routeId: number) {
  const db = getDb();
  await db
    .update(travelRoutes)
    .set({ viewCount: sql`${travelRoutes.viewCount} + 1` })
    .where(eq(travelRoutes.id, routeId));
}

async function getInteractableRoute(routeId: number, userId: number) {
  const db = getDb();
  const rows = await db.select().from(travelRoutes).where(eq(travelRoutes.id, routeId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.creatorId === userId) return row;
  if (row.status === RouteStatus.PUBLISHED && row.isPublic === 1) return row;
  return null;
}

export async function toggleRouteLike(routeId: number, userId: number) {
  const row = await getInteractableRoute(routeId, userId);
  if (!row) return null;

  const db = getDb();
  const existing = await db
    .select()
    .from(routeLikes)
    .where(and(eq(routeLikes.userId, userId), eq(routeLikes.routeId, routeId)))
    .limit(1);

  if (existing[0]) {
    await db
      .delete(routeLikes)
      .where(and(eq(routeLikes.userId, userId), eq(routeLikes.routeId, routeId)));
    await db
      .update(travelRoutes)
      .set({ likeCount: sql`GREATEST(${travelRoutes.likeCount} - 1, 0)` })
      .where(eq(travelRoutes.id, routeId));
    const updated = await db.select().from(travelRoutes).where(eq(travelRoutes.id, routeId)).limit(1);
    return { liked: false, likeCount: updated[0]?.likeCount ?? 0 };
  }

  await db.insert(routeLikes).values({ userId, routeId });
  await db
    .update(travelRoutes)
    .set({ likeCount: sql`${travelRoutes.likeCount} + 1` })
    .where(eq(travelRoutes.id, routeId));
  const updated = await db.select().from(travelRoutes).where(eq(travelRoutes.id, routeId)).limit(1);
  return { liked: true, likeCount: updated[0]?.likeCount ?? 0 };
}

export async function toggleRouteFavorite(routeId: number, userId: number) {
  const row = await getInteractableRoute(routeId, userId);
  if (!row) return null;

  const db = getDb();
  const existing = await db
    .select()
    .from(routeFavorites)
    .where(and(eq(routeFavorites.userId, userId), eq(routeFavorites.routeId, routeId)))
    .limit(1);

  if (existing[0]) {
    await db
      .delete(routeFavorites)
      .where(and(eq(routeFavorites.userId, userId), eq(routeFavorites.routeId, routeId)));
    await db
      .update(travelRoutes)
      .set({ collectCount: sql`GREATEST(${travelRoutes.collectCount} - 1, 0)` })
      .where(eq(travelRoutes.id, routeId));
    const updated = await db.select().from(travelRoutes).where(eq(travelRoutes.id, routeId)).limit(1);
    return { favorited: false, collectCount: updated[0]?.collectCount ?? 0 };
  }

  await db.insert(routeFavorites).values({ userId, routeId });
  await db
    .update(travelRoutes)
    .set({ collectCount: sql`${travelRoutes.collectCount} + 1` })
    .where(eq(travelRoutes.id, routeId));
  const updated = await db.select().from(travelRoutes).where(eq(travelRoutes.id, routeId)).limit(1);
  return { favorited: true, collectCount: updated[0]?.collectCount ?? 0 };
}
