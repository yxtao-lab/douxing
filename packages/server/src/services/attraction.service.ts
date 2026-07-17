import { eq, and, like, or, sql, inArray, count, gte, lte, isNull, isNotNull } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { attractions } from '../db/schema/attractions.js';
import {
  AttractionStatus,
  AttractionSource,
  AttractionPriceSource,
  AttractionCategory,
  ApiError,
  ApiMessageKey,
  buildPaginatedResult,
  normalizeSceneTags,
} from '@douxing/shared';
import type { AttractionInfo, AttractionOpenHours, PaginatedResult, RouteDetailPayload } from '@douxing/shared';
import { ATTRACTION_SEEDS } from '../data/attraction-seeds.js';
import { resolvePublicAssetUrl, normalizeStoredAssetPath } from '../utils/public-asset-url.util.js';
import { deleteStoredAttractionCover } from './attraction-cover-storage.service.js';

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
    sceneTags: row.sceneTags ?? [],
    description: row.description,
    ticketPrice: row.ticketPrice,
    aliases: row.aliases ?? null,
    openHours: row.openHours ?? null,
    status: row.status,
    source: row.source,
    priceSource: row.priceSource,
    matchConfidence: row.matchConfidence != null ? Number(row.matchConfidence) : null,
    priceUpdatedAt: row.priceUpdatedAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    coverImageUrl: resolvePublicAssetUrl(row.coverImageUrl),
    imageSource: row.imageSource ?? null,
    imageLicense: row.imageLicense ?? null,
    imageAttribution: row.imageAttribution ?? null,
    imageFetchedAt: row.imageFetchedAt?.toISOString() ?? null,
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
  /** P-TAG-01：按场景标签 slug 过滤（命中任一即返回） */
  sceneTags?: string[];
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
  if (options.sceneTags && options.sceneTags.length > 0) {
    const sceneSet = new Set(options.sceneTags);
    rows = rows.filter((row) => (row.sceneTags ?? []).some((t) => sceneSet.has(t)));
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

/** 封面补全等后台任务：含 active + pending，排除已禁用 */
export async function getAttractionForCoverEnrich(id: number) {
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

/** 路线详情 / 手帐封面注入：含 active + pending（AI 同步新建多为 pending） */
export async function getAttractionsByIdsForRouteMedia(ids: number[]) {
  if (ids.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(attractions)
    .where(
      and(
        inArray(attractions.id, ids),
        inArray(attractions.status, [AttractionStatus.ACTIVE, AttractionStatus.PENDING]),
      ),
    );
  return rows.map(toAttractionInfo);
}

/** H9-3：批量获取景点开放时长（Enricher 排程校验） */
export async function getOpenHoursByAttractionIds(
  ids: number[],
): Promise<Map<number, AttractionOpenHours>> {
  const uniqueIds = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (uniqueIds.length === 0) return new Map();

  const db = getDb();
  const rows = await db
    .select({
      id: attractions.id,
      openHours: attractions.openHours,
    })
    .from(attractions)
    .where(
      and(
        inArray(attractions.id, uniqueIds),
        inArray(attractions.status, [AttractionStatus.ACTIVE, AttractionStatus.PENDING]),
      ),
    );

  const map = new Map<number, AttractionOpenHours>();
  for (const row of rows) {
    if (row.openHours?.windows?.length || row.openHours?.closedWeekdays?.length) {
      map.set(row.id, row.openHours);
    }
  }
  return map;
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
      openHours: seed.openHours ?? null,
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

/** H9+-1：增量插入 seed 中尚未入库的景点（city + name 去重） */
export async function seedMissingAttractionSeeds(): Promise<number> {
  const db = getDb();
  const now = new Date();
  let created = 0;

  for (const seed of ATTRACTION_SEEDS) {
    const existing = await db
      .select({ id: attractions.id })
      .from(attractions)
      .where(and(eq(attractions.name, seed.name), eq(attractions.city, seed.city)))
      .limit(1);
    if (existing.length > 0) continue;

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
      openHours: seed.openHours ?? null,
      status: AttractionStatus.ACTIVE,
      source: AttractionSource.SEED,
      priceSource: AttractionPriceSource.SEED,
      priceUpdatedAt: now,
      verifiedAt: now,
      matchConfidence: null,
    });
    created += 1;
    console.log(`[seed] Created attraction: ${seed.city} · ${seed.name}`);
  }

  if (created === 0) {
    console.log('[seed] No missing attraction seeds to insert');
  }
  return created;
}

/** H9-3 扫尾：将 seed 中的 openHours 回填到已有景点（仅补空字段） */
export async function syncOpenHoursFromSeeds(options?: { dryRun?: boolean }) {
  const db = getDb();
  const seedsWithHours = ATTRACTION_SEEDS.filter(
    (seed) =>
      (seed.openHours?.windows?.length ?? 0) > 0 ||
      (seed.openHours?.closedWeekdays?.length ?? 0) > 0,
  );

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const seed of seedsWithHours) {
    const rows = await db
      .select({ id: attractions.id, openHours: attractions.openHours })
      .from(attractions)
      .where(and(eq(attractions.name, seed.name), eq(attractions.city, seed.city)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      missing += 1;
      continue;
    }

    const hasExisting =
      (row.openHours?.windows?.length ?? 0) > 0 ||
      (row.openHours?.closedWeekdays?.length ?? 0) > 0;
    if (hasExisting) {
      skipped += 1;
      continue;
    }

    if (!options?.dryRun) {
      await db
        .update(attractions)
        .set({ openHours: seed.openHours ?? null })
        .where(eq(attractions.id, row.id));
    }
    updated += 1;
  }

  return { updated, skipped, missing, total: seedsWithHours.length };
}

export interface AdminPendingAttractionListFilter {
  keyword?: string;
  city?: string;
  category?: string;
  source?: string;
  missingCoord?: boolean;
  dateStart?: string;
  dateEnd?: string;
}

function buildPendingAttractionWhere(filter?: AdminPendingAttractionListFilter) {
  const conditions = [eq(attractions.status, AttractionStatus.PENDING)];
  const keyword = filter?.keyword?.trim();
  if (keyword) {
    const pattern = `%${keyword}%`;
    conditions.push(or(like(attractions.name, pattern), like(attractions.description, pattern))!);
  }
  const city = filter?.city?.trim();
  if (city) {
    conditions.push(like(attractions.city, `%${city}%`));
  }
  if (filter?.category) {
    conditions.push(eq(attractions.category, filter.category));
  }
  if (filter?.source) {
    conditions.push(eq(attractions.source, filter.source));
  }
  if (filter?.missingCoord === true) {
    conditions.push(or(isNull(attractions.latitude), isNull(attractions.longitude))!);
  } else if (filter?.missingCoord === false) {
    conditions.push(and(isNotNull(attractions.latitude), isNotNull(attractions.longitude))!);
  }
  if (filter?.dateStart) {
    conditions.push(gte(attractions.updatedAt, new Date(`${filter.dateStart}T00:00:00`)));
  }
  if (filter?.dateEnd) {
    conditions.push(lte(attractions.updatedAt, new Date(`${filter.dateEnd}T23:59:59.999`)));
  }
  return and(...conditions);
}

export async function listPendingAttractionsPaginated(
  page: number,
  pageSize: number,
  filter?: AdminPendingAttractionListFilter,
) {
  const db = getDb();
  const where = buildPendingAttractionWhere(filter);
  const [{ value: total }] = await db.select({ value: count() }).from(attractions).where(where);
  const offset = (page - 1) * pageSize;
  const rows = await db
    .select()
    .from(attractions)
    .where(where)
    .orderBy(attractions.updatedAt)
    .limit(pageSize)
    .offset(offset);
  return buildPaginatedResult(rows.map(toAttractionInfo), Number(total ?? 0), page, pageSize);
}

export async function listAttractionsForAdminPaginated(options: {
  city?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}): Promise<PaginatedResult<AttractionInfo>> {
  const db = getDb();
  const pageSize = Math.min(Math.max(options.pageSize, 1), 100);
  const page = Math.max(options.page, 1);
  const offset = (page - 1) * pageSize;
  const conditions = [eq(attractions.status, AttractionStatus.ACTIVE)];

  if (options.city?.trim()) {
    conditions.push(eq(attractions.city, options.city.trim()));
  }
  if (options.keyword?.trim()) {
    const kw = `%${options.keyword.trim()}%`;
    conditions.push(or(like(attractions.name, kw), like(attractions.description, kw))!);
  }

  const where = and(...conditions);
  const [{ value: total }] = await db.select({ value: count() }).from(attractions).where(where);
  const rows = await db
    .select()
    .from(attractions)
    .where(where)
    .orderBy(attractions.city, attractions.name)
    .limit(pageSize)
    .offset(offset);

  return buildPaginatedResult(rows.map(toAttractionInfo), Number(total ?? 0), page, pageSize);
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

export async function updateAttractionCoverImage(
  id: number,
  input: {
    coverImageUrl: string;
    imageSource: string;
    imageLicense?: string | null;
    imageAttribution?: string | null;
  },
) {
  const db = getDb();
  const rows = await db.select().from(attractions).where(eq(attractions.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const storedPath = normalizeStoredAssetPath(input.coverImageUrl);
  if (!storedPath) {
    throw new ApiError(ApiMessageKey.ATTRACTION_COVER_INVALID);
  }

  const previousPath = row.coverImageUrl;

  const now = new Date();
  await db
    .update(attractions)
    .set({
      coverImageUrl: storedPath,
      imageSource: input.imageSource,
      imageLicense: input.imageLicense ?? null,
      imageAttribution: input.imageAttribution ?? null,
      imageFetchedAt: now,
    })
    .where(eq(attractions.id, id));

  if (previousPath && previousPath !== storedPath) {
    await deleteStoredAttractionCover(previousPath);
  }

  const updated = await db.select().from(attractions).where(eq(attractions.id, id)).limit(1);
  return updated[0] ? toAttractionInfo(updated[0]) : null;
}

/**
 * 更新景点的场景标签（P-TAG-01，管理端维护）。
 *
 * @param id - 景点 ID
 * @param sceneTags - 场景标签 slug 列表；非法 slug 会被过滤
 * @returns 更新后的景点信息；景点不存在返回 null
 */
export async function updateAttractionSceneTags(
  id: number,
  sceneTags: string[],
) {
  const db = getDb();
  const rows = await db.select().from(attractions).where(eq(attractions.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const cleaned = normalizeSceneTags(sceneTags);
  await db
    .update(attractions)
    .set({ sceneTags: cleaned })
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
