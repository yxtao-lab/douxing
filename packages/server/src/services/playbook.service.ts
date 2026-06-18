import { and, asc, eq, like, or, sql, count } from 'drizzle-orm';
import type { PaginatedResult, RoutePlaybookInfo } from '@douxing/shared';
import { ApiError, ApiMessageKey, buildPaginatedResult } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { routePlaybooks } from '../db/schema/route-playbooks.js';
import {
  ROUTE_PLAYBOOKS,
  assertValidPlaybookSegments,
  type RoutePlaybook,
} from '../data/route-playbooks.js';

const CACHE_TTL_MS = 30_000;
let cache: { loadedAt: number; items: RoutePlaybook[] } | null = null;

function rowToPlaybook(row: typeof routePlaybooks.$inferSelect): RoutePlaybookInfo {
  return {
    id: row.id,
    city: row.city,
    scope: row.scope,
    keywords: row.keywords ?? [],
    themes: row.themes ?? [],
    classicOrder: row.classicOrder ?? [],
    segments: row.segments ?? [],
    summaryZh: row.summaryZh,
    summaryEn: row.summaryEn,
    enabled: row.enabled === 1,
    sortOrder: row.sortOrder,
  };
}

function seedToInsert(playbook: RoutePlaybook, sortOrder: number) {
  assertValidPlaybookSegments(playbook.segments);
  return {
    id: playbook.id,
    city: playbook.city,
    scope: playbook.scope,
    keywords: playbook.keywords,
    themes: playbook.themes,
    classicOrder: playbook.classicOrder,
    segments: playbook.segments,
    summaryZh: playbook.summaryZh,
    summaryEn: playbook.summaryEn,
    enabled: 1,
    sortOrder,
  };
}

export function invalidatePlaybookCache(): void {
  cache = null;
}

/** RAG 用：仅启用中的动线 */
export async function loadEnabledRoutePlaybooks(): Promise<RoutePlaybook[]> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.items;
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(routePlaybooks)
    .where(eq(routePlaybooks.enabled, 1))
    .orderBy(asc(routePlaybooks.sortOrder), asc(routePlaybooks.city));

  let items: RoutePlaybook[];
  if (rows.length === 0) {
    items = ROUTE_PLAYBOOKS;
  } else {
    items = rows.map((row) => {
      const info = rowToPlaybook(row);
      const { enabled: _e, sortOrder: _s, ...rest } = info;
      return rest;
    });
  }

  cache = { loadedAt: now, items };
  return items;
}

export interface ListPlaybooksQuery {
  city?: string;
  keyword?: string;
  enabled?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listRoutePlaybooksForAdminPaginated(
  query: ListPlaybooksQuery = {},
): Promise<PaginatedResult<RoutePlaybookInfo>> {
  const db = getDb();
  const page = query.page && query.page >= 1 ? Math.floor(query.page) : 1;
  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 200);
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (query.city?.trim()) {
    conditions.push(eq(routePlaybooks.city, query.city.trim()));
  }
  if (query.enabled != null) {
    conditions.push(eq(routePlaybooks.enabled, query.enabled ? 1 : 0));
  }
  if (query.keyword?.trim()) {
    const kw = `%${query.keyword.trim()}%`;
    conditions.push(
      or(
        like(routePlaybooks.id, kw),
        like(routePlaybooks.city, kw),
        like(routePlaybooks.scope, kw),
        like(routePlaybooks.summaryZh, kw),
      ),
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const [{ value: total }] = await db.select({ value: count() }).from(routePlaybooks).where(where);
  const rows = await db
    .select()
    .from(routePlaybooks)
    .where(where)
    .orderBy(asc(routePlaybooks.sortOrder), asc(routePlaybooks.city))
    .limit(pageSize)
    .offset(offset);

  return buildPaginatedResult(rows.map(rowToPlaybook), Number(total ?? 0), page, pageSize);
}

export async function getRoutePlaybookById(id: string): Promise<RoutePlaybookInfo | null> {
  const db = getDb();
  const rows = await db.select().from(routePlaybooks).where(eq(routePlaybooks.id, id)).limit(1);
  const row = rows[0];
  return row ? rowToPlaybook(row) : null;
}

export type UpsertRoutePlaybookInput = Omit<RoutePlaybookInfo, 'enabled' | 'sortOrder'> & {
  enabled?: boolean;
  sortOrder?: number;
};

function ensureValidPlaybookSegments(segments: RoutePlaybookInfo['segments']): void {
  try {
    assertValidPlaybookSegments(segments);
  } catch {
    throw new ApiError(ApiMessageKey.PLAYBOOK_VALIDATION_FAILED);
  }
}

export async function createRoutePlaybook(input: UpsertRoutePlaybookInput): Promise<RoutePlaybookInfo> {
  ensureValidPlaybookSegments(input.segments);
  const db = getDb();

  const existing = await getRoutePlaybookById(input.id);
  if (existing) {
    throw new ApiError(ApiMessageKey.PLAYBOOK_ID_EXISTS);
  }

  await db.insert(routePlaybooks).values({
    id: input.id.trim(),
    city: input.city.trim(),
    scope: input.scope.trim(),
    keywords: input.keywords,
    themes: input.themes,
    classicOrder: input.classicOrder,
    segments: input.segments,
    summaryZh: input.summaryZh.trim(),
    summaryEn: input.summaryEn.trim(),
    enabled: input.enabled === false ? 0 : 1,
    sortOrder: input.sortOrder ?? 0,
  });

  invalidatePlaybookCache();
  const created = await getRoutePlaybookById(input.id);
  if (!created) throw new ApiError(ApiMessageKey.PLAYBOOK_CREATE_FAILED);
  return created;
}

export async function updateRoutePlaybook(
  id: string,
  input: Partial<UpsertRoutePlaybookInput>,
): Promise<RoutePlaybookInfo | null> {
  const existing = await getRoutePlaybookById(id);
  if (!existing) return null;

  if (input.segments) {
    ensureValidPlaybookSegments(input.segments);
  }

  const db = getDb();
  await db
    .update(routePlaybooks)
    .set({
      ...(input.city != null ? { city: input.city.trim() } : {}),
      ...(input.scope != null ? { scope: input.scope.trim() } : {}),
      ...(input.keywords != null ? { keywords: input.keywords } : {}),
      ...(input.themes != null ? { themes: input.themes } : {}),
      ...(input.classicOrder != null ? { classicOrder: input.classicOrder } : {}),
      ...(input.segments != null ? { segments: input.segments } : {}),
      ...(input.summaryZh != null ? { summaryZh: input.summaryZh.trim() } : {}),
      ...(input.summaryEn != null ? { summaryEn: input.summaryEn.trim() } : {}),
      ...(input.enabled != null ? { enabled: input.enabled ? 1 : 0 } : {}),
      ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
      updatedAt: sql`NOW()`,
    })
    .where(eq(routePlaybooks.id, id));

  invalidatePlaybookCache();
  return getRoutePlaybookById(id);
}

export async function deleteRoutePlaybook(id: string): Promise<boolean> {
  const existing = await getRoutePlaybookById(id);
  if (!existing) return false;

  const db = getDb();
  await db.delete(routePlaybooks).where(eq(routePlaybooks.id, id));
  invalidatePlaybookCache();
  return true;
}

/** db:seed 与迁移后初始化 */
export async function seedRoutePlaybooks(): Promise<void> {
  const db = getDb();
  let order = 0;
  for (const playbook of ROUTE_PLAYBOOKS) {
    const existing = await db
      .select({ id: routePlaybooks.id })
      .from(routePlaybooks)
      .where(eq(routePlaybooks.id, playbook.id))
      .limit(1);
    if (existing.length > 0) {
      order += 1;
      continue;
    }
    await db.insert(routePlaybooks).values(seedToInsert(playbook, order));
    console.log(`[seed] Created route playbook: ${playbook.id}`);
    order += 1;
  }
}
