import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { RouteStatus } from '@douxing/shared';
import type { TravelRouteInfo } from '@douxing/shared';
import { generateRoute, type GenerateRouteInput } from './route-generator.service.js';
import { syncAttractionsFromRouteDetail } from './attraction.service.js';

function toRouteInfo(row: typeof travelRoutes.$inferSelect): TravelRouteInfo {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    budgetRange: row.budgetRange,
    days: row.days,
    interestTags: row.interestTags,
    routeDetail: row.routeDetail,
    creatorId: row.creatorId,
    status: row.status,
    isAiGenerated: (row.routeDetail as Record<string, unknown> | null)?.isAiGenerated === true,
    unlockPrice: (row.routeDetail as Record<string, unknown> | null)?.unlockPrice as number | undefined,
    isUnlocked: (row.routeDetail as Record<string, unknown> | null)?.isUnlocked === true,
  };
}

export async function createRouteFromPrompt(userId: number, input: GenerateRouteInput) {
  const draft = await generateRoute(input);
  const db = getDb();
  const linkedDays = await syncAttractionsFromRouteDetail(draft.routeDetail, {
    city: draft.matchedCity || '未知',
    interestTags: draft.interestTags,
  });
  const detail = {
    days: linkedDays.days,
    isAiGenerated: draft.isAiGenerated,
    unlockPrice: draft.unlockPrice,
    isUnlocked: false,
    matchedCity: draft.matchedCity,
    generationSource: draft.generationSource,
    llmProvider: draft.llmProvider,
  };

  const [result] = await db.insert(travelRoutes).values({
    name: draft.name,
    description: draft.description,
    budgetRange: draft.budgetRange,
    days: draft.days,
    interestTags: draft.interestTags,
    routeDetail: detail,
    creatorId: userId,
    status: RouteStatus.DRAFT,
  });

  const id = Number(result.insertId);
  const rows = await db.select().from(travelRoutes).where(eq(travelRoutes.id, id)).limit(1);
  const route = toRouteInfo(rows[0]!);
  return {
    route,
    generationSource: draft.generationSource,
    llmProvider: draft.llmProvider,
  };
}

export async function listUserRoutes(userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(travelRoutes)
    .where(eq(travelRoutes.creatorId, userId))
    .orderBy(desc(travelRoutes.createdAt));
  return rows.map(toRouteInfo);
}

export async function getRouteById(routeId: number, userId?: number) {
  const db = getDb();
  const rows = await db.select().from(travelRoutes).where(eq(travelRoutes.id, routeId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (userId && row.creatorId !== userId) {
    const isPublished = row.status === RouteStatus.PUBLISHED;
    if (!isPublished) return null;
  }
  return toRouteInfo(row);
}

export async function publishRoute(routeId: number, userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(travelRoutes)
    .where(and(eq(travelRoutes.id, routeId), eq(travelRoutes.creatorId, userId)))
    .limit(1);
  if (!rows[0]) return null;

  await db
    .update(travelRoutes)
    .set({ status: RouteStatus.PUBLISHED })
    .where(eq(travelRoutes.id, routeId));

  return getRouteById(routeId, userId);
}

export async function unlockRoute(routeId: number, userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(travelRoutes)
    .where(and(eq(travelRoutes.id, routeId), eq(travelRoutes.creatorId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const detail = (row.routeDetail ?? {}) as Record<string, unknown>;
  detail.isUnlocked = true;

  await db.update(travelRoutes).set({ routeDetail: detail }).where(eq(travelRoutes.id, routeId));
  return getRouteById(routeId, userId);
}

export async function listAllRoutesForAdmin() {
  const db = getDb();
  const rows = await db.select().from(travelRoutes).orderBy(desc(travelRoutes.createdAt));
  return rows.map(toRouteInfo);
}
