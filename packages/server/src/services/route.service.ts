import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { RouteStatus, ApiError, ApiMessageKey } from '@douxing/shared';
import type { TravelRouteInfo, UpdateRouteDraftRequest } from '@douxing/shared';
import { generateRoute, type GenerateRouteInput } from './route-generator.service.js';
import { syncAttractionsFromRouteDetail } from './attraction.service.js';
import type { RouteDayPlan } from '@douxing/shared';
import {
  normalizeRouteDetailDays,
  cloneRouteDaysForSync,
} from '../utils/route-detail.util.js';
import { toRouteInfo } from '../utils/route-info.util.js';
import {
  enrichRoutesWithUserFlags,
  enrichRoutesWithCreatorInfo,
  incrementRouteViewCount,
} from './route-interaction.service.js';
import { isRouteUnlockPaymentRequired } from '../config/route-unlock.js';

export { toRouteInfo };

async function syncDraftToAttractionLibrary(
  draft: Awaited<ReturnType<typeof generateRoute>>,
  options: { stripAttractionIds?: boolean } = {},
) {
  const { days } = normalizeRouteDetailDays(draft.routeDetail);
  if (days.length === 0) {
    throw new ApiError(ApiMessageKey.ROUTE_NO_VALID_NODES);
  }
  const routeDetailForSync = {
    days: cloneRouteDaysForSync(days, options.stripAttractionIds ?? false),
  };
  return syncAttractionsFromRouteDetail(routeDetailForSync, {
    city: draft.matchedCity || '未知',
    interestTags: draft.interestTags,
  });
}

function mergeEnrichedDaysWithSyncedAttractions(
  enrichedDays: RouteDayPlan[],
  syncedDays: RouteDayPlan[],
): RouteDayPlan[] {
  return enrichedDays.map((day, dayIndex) => {
    const syncedDay = syncedDays[dayIndex];
    if (!syncedDay) return day;

    const syncedByName = new Map(syncedDay.attractions.map((spot) => [spot.name, spot]));
    const attractions = day.attractions.map((spot, spotIndex) => {
      const syncedSpot = syncedByName.get(spot.name) ?? syncedDay.attractions[spotIndex];
      if (!syncedSpot) return spot;
      return {
        ...spot,
        attractionId: syncedSpot.attractionId,
        latitude: spot.latitude ?? syncedSpot.latitude,
        longitude: spot.longitude ?? syncedSpot.longitude,
        poiType: spot.poiType ?? syncedSpot.poiType,
      };
    });

    return {
      date: day.date,
      title: day.title,
      attractions,
      lodging: day.lodging,
      transit: day.transit,
      warnings: day.warnings,
    };
  });
}

function buildRouteDetailFromDraft(
  draft: Awaited<ReturnType<typeof generateRoute>>,
  linkedDays: Awaited<ReturnType<typeof syncAttractionsFromRouteDetail>>,
  options: { sourcePrompt: string; provider?: GenerateRouteInput['provider'] },
) {
  const enrichedDays = normalizeRouteDetailDays(draft.routeDetail).days;
  const days = mergeEnrichedDaysWithSyncedAttractions(enrichedDays, linkedDays.days);

  return {
    days,
    isAiGenerated: draft.isAiGenerated,
    unlockPrice: draft.unlockPrice,
    isUnlocked: !isRouteUnlockPaymentRequired(),
    matchedCity: draft.matchedCity,
    generationSource: draft.generationSource,
    llmProvider: draft.llmProvider,
    sourcePrompt: options.sourcePrompt,
    llmProviderChoice: options.provider ?? 'auto',
    ragCandidateCount: draft.ragCandidateCount ?? 0,
    ragMatchedCount: draft.ragMatchedCount ?? 0,
  };
}

export async function createRouteFromPrompt(userId: number, input: GenerateRouteInput) {
  const draft = await generateRoute(input);
  const db = getDb();
  const linkedDays = await syncDraftToAttractionLibrary(draft);
  const detail = buildRouteDetailFromDraft(draft, linkedDays, {
    sourcePrompt: input.prompt.trim(),
    provider: input.provider,
  });

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
  const route = toRouteInfo(rows[0]!, { viewerId: userId });
  return {
    route,
    generationSource: draft.generationSource,
    llmProvider: draft.llmProvider,
    intent: draft.intent,
  };
}

export async function listUserRoutes(userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(travelRoutes)
    .where(eq(travelRoutes.creatorId, userId))
    .orderBy(desc(travelRoutes.createdAt));
  const routes = rows.map((row) => toRouteInfo(row, { viewerId: userId }));
  return enrichRoutesWithUserFlags(routes, userId);
}

export async function getRouteById(routeId: number, userId?: number, options?: { recordView?: boolean }) {
  const db = getDb();
  const rows = await db.select().from(travelRoutes).where(eq(travelRoutes.id, routeId)).limit(1);
  const row = rows[0];
  if (!row) return null;

  if (userId) {
    const isOwner = row.creatorId === userId;
    if (!isOwner) {
      const canView = row.status === RouteStatus.PUBLISHED && row.isPublic === 1;
      if (!canView) return null;
    }
  }

  if (options?.recordView !== false) {
    await incrementRouteViewCount(routeId);
    row.viewCount = (row.viewCount ?? 0) + 1;
  }

  let [route] = userId
    ? await enrichRoutesWithUserFlags([toRouteInfo(row, { viewerId: userId })], userId)
    : [toRouteInfo(row)];

  if (route && userId && row.creatorId !== userId) {
    [route] = await enrichRoutesWithCreatorInfo([route]);
  }

  return route ?? null;
}

export async function setRoutePublicShare(routeId: number, userId: number, isPublic: boolean) {
  const db = getDb();
  const rows = await db
    .select()
    .from(travelRoutes)
    .where(and(eq(travelRoutes.id, routeId), eq(travelRoutes.creatorId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  if (isPublic && row.status !== RouteStatus.PUBLISHED) {
    throw new ApiError(ApiMessageKey.ROUTE_PUBLISH_BEFORE_SHARE);
  }

  await db
    .update(travelRoutes)
    .set({ isPublic: isPublic ? 1 : 0 })
    .where(eq(travelRoutes.id, routeId));

  return getRouteById(routeId, userId, { recordView: false });
}

export async function updateDraftRoute(
  routeId: number,
  userId: number,
  input: UpdateRouteDraftRequest,
) {
  const db = getDb();
  const rows = await db
    .select()
    .from(travelRoutes)
    .where(and(eq(travelRoutes.id, routeId), eq(travelRoutes.creatorId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.status !== RouteStatus.DRAFT) {
    throw new ApiError(ApiMessageKey.ROUTE_DRAFT_ONLY_EDIT);
  }

  const existingDetail = (row.routeDetail ?? {}) as Record<string, unknown>;
  const patch: Partial<typeof travelRoutes.$inferInsert> = {};

  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (input.budgetRange !== undefined) patch.budgetRange = input.budgetRange;
  if (input.days !== undefined) patch.days = input.days;
  if (input.interestTags !== undefined) patch.interestTags = input.interestTags;

  if (input.routeDetail !== undefined) {
    patch.routeDetail = {
      ...existingDetail,
      days: input.routeDetail.days,
      isAiGenerated: input.routeDetail.isAiGenerated ?? existingDetail.isAiGenerated,
      unlockPrice: input.routeDetail.unlockPrice ?? existingDetail.unlockPrice,
      isUnlocked: input.routeDetail.isUnlocked ?? existingDetail.isUnlocked,
      matchedCity: input.routeDetail.matchedCity ?? existingDetail.matchedCity,
      generationSource: input.routeDetail.generationSource ?? existingDetail.generationSource,
      llmProvider: input.routeDetail.llmProvider ?? existingDetail.llmProvider,
      sourcePrompt: input.routeDetail.sourcePrompt ?? existingDetail.sourcePrompt,
      llmProviderChoice: existingDetail.llmProviderChoice,
    };
  }

  if (Object.keys(patch).length === 0) {
    return getRouteById(routeId, userId, { recordView: false });
  }

  await db.update(travelRoutes).set(patch).where(eq(travelRoutes.id, routeId));
  return getRouteById(routeId, userId, { recordView: false });
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
  return rows.map((row) => toRouteInfo(row));
}

export async function regenerateRouteFromPrompt(
  routeId: number,
  userId: number,
  input: GenerateRouteInput,
) {
  const db = getDb();
  const rows = await db
    .select()
    .from(travelRoutes)
    .where(and(eq(travelRoutes.id, routeId), eq(travelRoutes.creatorId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const existingDetail = (row.routeDetail ?? {}) as Record<string, unknown>;
  if (existingDetail.isAiGenerated !== true) {
    throw new ApiError(ApiMessageKey.ROUTE_AI_REGENERATE_ONLY);
  }
  if (row.status !== RouteStatus.DRAFT) {
    throw new ApiError(ApiMessageKey.ROUTE_PUBLISHED_NO_REGENERATE);
  }

  const draft = await generateRoute({
    ...input,
    provider: input.provider ?? (existingDetail.llmProviderChoice as GenerateRouteInput['provider']),
    history: input.history,
  });
  const linkedDays = await syncDraftToAttractionLibrary(draft, { stripAttractionIds: true });
  const detail = buildRouteDetailFromDraft(draft, linkedDays, {
    sourcePrompt: input.prompt.trim(),
    provider: input.provider ?? (existingDetail.llmProviderChoice as GenerateRouteInput['provider']),
  });

  await db
    .update(travelRoutes)
    .set({
      name: draft.name,
      description: draft.description,
      budgetRange: draft.budgetRange,
      days: draft.days,
      interestTags: draft.interestTags,
      routeDetail: detail,
    })
    .where(eq(travelRoutes.id, routeId));

  const route = await getRouteById(routeId, userId);
  if (!route) return null;
  return {
    route,
    generationSource: draft.generationSource,
    llmProvider: draft.llmProvider,
    intent: draft.intent,
  };
}
