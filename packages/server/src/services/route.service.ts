import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { RouteStatus } from '@douxing/shared';
import type { TravelRouteInfo } from '@douxing/shared';
import { generateRoute, type GenerateRouteInput } from './route-generator.service.js';
import { syncAttractionsFromRouteDetail } from './attraction.service.js';
import {
  normalizeRouteDetailDays,
  cloneRouteDaysForSync,
} from '../utils/route-detail.util.js';

function toRouteInfo(row: typeof travelRoutes.$inferSelect): TravelRouteInfo {
  const detail = row.routeDetail as Record<string, unknown> | null;
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
    isAiGenerated: detail?.isAiGenerated === true,
    unlockPrice: detail?.unlockPrice as number | undefined,
    isUnlocked: detail?.isUnlocked === true,
    generationSource: detail?.generationSource as TravelRouteInfo['generationSource'],
    llmProvider: detail?.llmProvider as TravelRouteInfo['llmProvider'],
    sourcePrompt: (detail?.sourcePrompt as string | undefined) ?? null,
  };
}

async function syncDraftToAttractionLibrary(
  draft: Awaited<ReturnType<typeof generateRoute>>,
  options: { stripAttractionIds?: boolean } = {},
) {
  const { days } = normalizeRouteDetailDays(draft.routeDetail);
  if (days.length === 0) {
    throw new Error('生成的路线没有有效行程节点，无法同步景点库');
  }
  const routeDetailForSync = {
    days: cloneRouteDaysForSync(days, options.stripAttractionIds ?? false),
  };
  return syncAttractionsFromRouteDetail(routeDetailForSync, {
    city: draft.matchedCity || '未知',
    interestTags: draft.interestTags,
  });
}

function buildRouteDetailFromDraft(
  draft: Awaited<ReturnType<typeof generateRoute>>,
  linkedDays: Awaited<ReturnType<typeof syncAttractionsFromRouteDetail>>,
  options: { sourcePrompt: string; provider?: GenerateRouteInput['provider'] },
) {
  return {
    days: linkedDays.days,
    isAiGenerated: draft.isAiGenerated,
    unlockPrice: draft.unlockPrice,
    isUnlocked: false,
    matchedCity: draft.matchedCity,
    generationSource: draft.generationSource,
    llmProvider: draft.llmProvider,
    sourcePrompt: options.sourcePrompt,
    llmProviderChoice: options.provider ?? 'auto',
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
    throw new Error('仅 AI 生成的路线支持重新生成');
  }
  if (row.status !== RouteStatus.DRAFT) {
    throw new Error('已发布的路线不可重新生成，请复制需求后新建路线');
  }

  const draft = await generateRoute({
    ...input,
    provider: input.provider ?? (existingDetail.llmProviderChoice as GenerateRouteInput['provider']),
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
  };
}
