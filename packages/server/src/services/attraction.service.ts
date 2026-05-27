import { eq, and, like, or, sql, inArray } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { attractions } from '../db/schema/attractions.js';
import {
  AttractionStatus,
  AttractionSource,
  AttractionPriceSource,
  AttractionCategory,
  ApiError,
  ApiMessageKey,
} from '@douxing/shared';
import type { AttractionInfo, RouteDetailPayload } from '@douxing/shared';
import { ATTRACTION_SEEDS } from '../data/attraction-seeds.js';

export { syncAttractionsFromRouteDetail } from './attraction-sync.service.js';

function toAttractionInfo(row: typeof attractions.$inferSelect): AttractionInfo {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    city: row.city,
    cityCode: row.cityCode,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    tags: row.tags,
    description: row.description,
    ticketPrice: row.ticketPrice,
    aliases: row.aliases ?? null,
    status: row.status,
    source: row.source,
    priceSource: row.priceSource,
    matchConfidence: row.matchConfidence != null ? Number(row.matchConfidence) : null,
    priceUpdatedAt: row.priceUpdatedAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
  };
}

/** @deprecated 请使用 syncAttractionsFromRouteDetail */
export async function enrichRouteDetailWithAttractionIds(
  routeDetail: { days: import('../data/route-templates.js').RouteDayPlan[] },
  city?: string | null,
  interestTags?: string[],
) {
  const { syncAttractionsFromRouteDetail } = await import('./attraction-sync.service.js');
  return syncAttractionsFromRouteDetail(routeDetail, {
    city: city ?? '未知',
    interestTags,
  });
}

export async function listAttractions(options: {
  city?: string;
  cityCode?: string;
  category?: string;
  tags?: string[];
  keyword?: string;
  limit?: number;
  offset?: number;
}) {
  const db = getDb();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  const conditions = [eq(attractions.status, AttractionStatus.ACTIVE)];

  if (options.city) {
    conditions.push(eq(attractions.city, options.city));
  }
  if (options.cityCode) {
    conditions.push(eq(attractions.cityCode, options.cityCode));
  }
  if (options.category) {
    conditions.push(eq(attractions.category, options.category));
  }
  if (options.keyword?.trim()) {
    const kw = `%${options.keyword.trim()}%`;
    conditions.push(
      or(like(attractions.name, kw), like(attractions.description, kw))!,
    );
  }

  let rows = await db
    .select()
    .from(attractions)
    .where(and(...conditions))
    .orderBy(attractions.city, attractions.name)
    .limit(limit)
    .offset(offset);

  if (options.tags && options.tags.length > 0) {
    const tagSet = new Set(options.tags);
    rows = rows.filter((row) => row.tags.some((t) => tagSet.has(t)));
  }

  return rows.map(toAttractionInfo);
}

export async function getAttractionById(id: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(attractions)
    .where(and(eq(attractions.id, id), eq(attractions.status, AttractionStatus.ACTIVE)))
    .limit(1);
  return rows[0] ? toAttractionInfo(rows[0]) : null;
}

/** 打卡等业务使用：允许已发布与待审核景点，排除已禁用 */
export async function getAttractionForCheckIn(id: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(attractions)
    .where(
      and(
        eq(attractions.id, id),
        inArray(attractions.status, [AttractionStatus.ACTIVE, AttractionStatus.PENDING]),
      ),
    )
    .limit(1);
  return rows[0] ? toAttractionInfo(rows[0]) : null;
}

export async function getAttractionsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(attractions)
    .where(
      and(
        inArray(attractions.id, ids),
        eq(attractions.status, AttractionStatus.ACTIVE),
      ),
    );
  return rows.map(toAttractionInfo);
}

export async function listCitiesWithAttractions() {
  const db = getDb();
  const rows = await db
    .select({
      city: attractions.city,
      cityCode: attractions.cityCode,
      count: sql<number>`count(*)`,
    })
    .from(attractions)
    .where(eq(attractions.status, AttractionStatus.ACTIVE))
    .groupBy(attractions.city, attractions.cityCode)
    .orderBy(attractions.city);

  return rows.map((r) => ({
    city: r.city,
    cityCode: r.cityCode,
    count: Number(r.count),
  }));
}

export async function seedAttractions() {
  const db = getDb();
  const existing = await db.select({ id: attractions.id }).from(attractions).limit(1);
  if (existing.length > 0) {
    console.log('[seed] Attractions already exist, skip');
    return;
  }

  const now = new Date();
  for (const seed of ATTRACTION_SEEDS) {
    await db.insert(attractions).values({
      name: seed.name,
      category: AttractionCategory.ATTRACTION,
      city: seed.city,
      cityCode: seed.cityCode,
      latitude: seed.latitude,
      longitude: seed.longitude,
      tags: seed.tags,
      description: seed.description,
      ticketPrice: seed.ticketPrice,
      aliases: seed.aliases ?? null,
      status: AttractionStatus.ACTIVE,
      source: AttractionSource.SEED,
      priceSource: AttractionPriceSource.SEED,
      priceUpdatedAt: now,
      verifiedAt: now,
      matchConfidence: null,
    });
  }
  console.log(`[seed] Created ${ATTRACTION_SEEDS.length} attractions`);
}

export async function listPendingAttractions(limit = 50) {
  const db = getDb();
  const rows = await db
    .select()
    .from(attractions)
    .where(eq(attractions.status, AttractionStatus.PENDING))
    .orderBy(attractions.updatedAt)
    .limit(Math.min(limit, 100));
  return rows.map(toAttractionInfo);
}

export async function approveAttraction(id: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(attractions)
    .where(eq(attractions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.status !== AttractionStatus.PENDING) {
    throw new ApiError(ApiMessageKey.ATTRACTION_APPROVE_PENDING_ONLY);
  }

  const now = new Date();
  await db
    .update(attractions)
    .set({
      status: AttractionStatus.ACTIVE,
      verifiedAt: now,
    })
    .where(eq(attractions.id, id));

  const updated = await db.select().from(attractions).where(eq(attractions.id, id)).limit(1);
  return updated[0] ? toAttractionInfo(updated[0]) : null;
}

export function extractAttractionIdsFromRouteDetail(
  routeDetail: RouteDetailPayload | Record<string, unknown> | null,
): number[] {
  if (!routeDetail || typeof routeDetail !== 'object') return [];
  const days = (routeDetail as RouteDetailPayload).days;
  if (!Array.isArray(days)) return [];

  const ids: number[] = [];
  for (const day of days) {
    if (!day?.attractions) continue;
    for (const spot of day.attractions) {
      if (spot.attractionId != null) ids.push(spot.attractionId);
    }
  }
  return [...new Set(ids)];
}
