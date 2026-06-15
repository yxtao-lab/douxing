import { eq, desc, and, or, like, sql, inArray, count } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { routeLikes } from '../db/schema/route-likes.js';
import { routeFavorites } from '../db/schema/route-favorites.js';
import { users } from '../db/schema/users.js';
import { RouteStatus, buildPaginatedResult } from '@douxing/shared';
import type { PaginatedResult, RouteListQuery, TravelRouteInfo } from '@douxing/shared';
import { toRouteInfo } from '../utils/route-info.util.js';
import { resolvePublicAssetUrl, rewritePublicAssetUrl } from '../utils/public-asset-url.util.js';
import { enrichRoutesWithListCoverImages } from './route-list-cover.service.js';

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

/** 仅匹配路线表字段，不检索 routeDetail 中的景点节点 */
function buildKeywordCondition(keyword?: string) {
  const trimmed = keyword?.trim();
  if (!trimmed) return undefined;
  const kw = `%${trimmed}%`;
  return or(like(travelRoutes.name, kw), like(travelRoutes.description, kw));
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
  result = await enrichRoutesWithListCoverImages(result, (stored) =>
    resolvePublicAssetUrl(stored, {}) ?? stored,
  );
  return result;
}

export async function listRoutesForUser(
  userId: number,
  query: RouteListQuery = {},
): Promise<PaginatedResult<TravelRouteInfo>> {
  const db = getDb();
  const scope = query.scope ?? 'mine';
  const page = query.page && query.page >= 1 ? Math.floor(query.page) : 1;
  const pageSize = Math.min(
    Math.max(query.pageSize ?? query.limit ?? 50, 1),
    100,
  );
  const offset = (page - 1) * pageSize;
  const orderBy = resolveOrderBy(query.sort, scope);

  const keywordCondition = buildKeywordCondition(query.keyword);

  if (scope === 'plaza' || scope === 'hot') {
    const where = and(
      eq(travelRoutes.status, RouteStatus.PUBLISHED),
      eq(travelRoutes.isPublic, 1),
      keywordCondition,
    );
    const [{ value: total }] = await db.select({ value: count() }).from(travelRoutes).where(where);
    const rows = await db
      .select()
      .from(travelRoutes)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset);
    const routes = mapRowsForViewer(rows, userId);
    const items = await finalizeRouteList(routes, userId, true);
    return buildPaginatedResult(items, Number(total ?? 0), page, pageSize);
  }

  if (scope === 'favorites') {
    const where = and(eq(routeFavorites.userId, userId), keywordCondition);
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(routeFavorites)
      .where(where);
    const rows = await db
      .select({ route: travelRoutes })
      .from(routeFavorites)
      .innerJoin(travelRoutes, eq(routeFavorites.routeId, travelRoutes.id))
      .where(where)
      .orderBy(desc(routeFavorites.createdAt))
      .limit(pageSize)
      .offset(offset);
    const routes = rows.map((r) => toRouteInfo(r.route, { viewerId: userId }));
    const items = await finalizeRouteList(routes, userId, true);
    return buildPaginatedResult(items, Number(total ?? 0), page, pageSize);
  }

  const conditions = [eq(travelRoutes.creatorId, userId)];
  if (query.status !== undefined && !Number.isNaN(query.status)) {
    conditions.push(eq(travelRoutes.status, query.status));
  }
  if (keywordCondition) {
    conditions.push(keywordCondition);
  }
  const where = and(...conditions);
  const [{ value: total }] = await db.select({ value: count() }).from(travelRoutes).where(where);
  const rows = await db
    .select()
    .from(travelRoutes)
    .where(where)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  const routes = mapRowsForViewer(rows, userId);
  const items = await finalizeRouteList(routes, userId, false);
  return buildPaginatedResult(items, Number(total ?? 0), page, pageSize);
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
