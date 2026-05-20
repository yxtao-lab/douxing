import { eq, and, inArray } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { attractions, type Attraction } from '../db/schema/attractions.js';
import {
  AttractionStatus,
  AttractionSource,
  AttractionPriceSource,
  ATTRACTION_MATCH_MERGE_THRESHOLD,
  ATTRACTION_LLM_PRICE_STALE_DAYS,
} from '@douxing/shared';
import type { RouteDayAttraction } from '@douxing/shared';
import { resolveCityCode } from '../data/city-codes.js';
import type { RouteDayPlan } from '../data/route-templates.js';

export type AttractionMatchType = 'exact_name' | 'exact_alias' | 'fuzzy';

export interface AttractionMatchResult {
  row: Attraction;
  confidence: number;
  matchType: AttractionMatchType;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, '');
}

function mergeUniqueStrings(base: string[], extra: string[]): string[] {
  const set = new Set(base.map((s) => s.trim()).filter(Boolean));
  for (const item of extra) {
    const t = item.trim();
    if (t) set.add(t);
  }
  return [...set];
}

function mergeAliases(
  existing: string[] | null,
  spotName: string,
  canonicalName: string,
): string[] {
  const aliases = [...(existing ?? [])];
  const normalizedCanonical = normalizeName(canonicalName);
  const normalizedSpot = normalizeName(spotName);
  if (normalizedSpot && normalizedSpot !== normalizedCanonical) {
    aliases.push(spotName.trim());
  }
  return mergeUniqueStrings(aliases, []);
}

function pickLongerDescription(current: string | null, incoming: string): string | null {
  const a = (current ?? '').trim();
  const b = incoming.trim();
  if (!b) return current;
  if (!a) return b;
  return b.length > a.length ? b : a;
}

function isTrustedSource(source: string): boolean {
  return source === AttractionSource.SEED || source === AttractionSource.MANUAL;
}

function isPriceStale(row: Attraction): boolean {
  if (!row.priceUpdatedAt) return true;
  const staleMs = ATTRACTION_LLM_PRICE_STALE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - row.priceUpdatedAt.getTime() > staleMs;
}

function estimateTicketFromCost(cost: number): number {
  if (!Number.isFinite(cost) || cost < 0) return 0;
  return Math.round(cost);
}

function statusActiveOrPending() {
  return inArray(attractions.status, [AttractionStatus.ACTIVE, AttractionStatus.PENDING]);
}

/** 在库内解析景点（含 active + pending） */
export async function resolveAttractionMatch(
  name: string,
  city?: string | null,
): Promise<AttractionMatchResult | null> {
  const normalized = normalizeName(name);
  if (!normalized) return null;

  const db = getDb();
  const conditions = [statusActiveOrPending()];
  if (city?.trim()) {
    conditions.push(eq(attractions.city, city.trim()));
  }

  const rows = await db
    .select()
    .from(attractions)
    .where(and(...conditions));

  for (const row of rows) {
    if (normalizeName(row.name) === normalized) {
      return { row, confidence: 1, matchType: 'exact_name' };
    }
    const aliases = row.aliases ?? [];
    if (aliases.some((a) => normalizeName(a) === normalized)) {
      return { row, confidence: 0.95, matchType: 'exact_alias' };
    }
  }

  for (const row of rows) {
    const rowName = normalizeName(row.name);
    if (rowName.includes(normalized) || normalized.includes(rowName)) {
      return { row, confidence: 0.72, matchType: 'fuzzy' };
    }
    const aliases = row.aliases ?? [];
    for (const alias of aliases) {
      const a = normalizeName(alias);
      if (a.includes(normalized) || normalized.includes(a)) {
        return { row, confidence: 0.72, matchType: 'fuzzy' };
      }
    }
  }

  return null;
}

interface MergeInput {
  spot: RouteDayAttraction;
  routeTags: string[];
}

/** 将 LLM/路线节点数据按来源策略合并到已有景点 */
function buildMergedFields(existing: Attraction, input: MergeInput) {
  const { spot, routeTags } = input;
  const incomingPrice = estimateTicketFromCost(spot.cost);
  const mergedTags = mergeUniqueStrings(existing.tags, routeTags);
  const mergedAliases = mergeAliases(existing.aliases, spot.name, existing.name);
  const mergedDescription = pickLongerDescription(existing.description, spot.description);

  const updates: Partial<typeof attractions.$inferInsert> = {
    tags: mergedTags,
    aliases: mergedAliases.length > 0 ? mergedAliases : existing.aliases,
    description: mergedDescription,
  };

  if (isTrustedSource(existing.source)) {
    return updates;
  }

  if (existing.source === AttractionSource.LLM) {
    if (
      incomingPrice > 0 &&
      (existing.ticketPrice === 0 || isPriceStale(existing))
    ) {
      updates.ticketPrice = incomingPrice;
      updates.priceSource = AttractionPriceSource.LLM_ESTIMATE;
      updates.priceUpdatedAt = new Date();
    }
  }

  return updates;
}

async function insertPendingAttraction(
  spot: RouteDayAttraction,
  city: string,
  routeTags: string[],
): Promise<number> {
  const db = getDb();
  const ticketPrice = estimateTicketFromCost(spot.cost);
  const tags = mergeUniqueStrings(routeTags.length > 0 ? routeTags : ['休闲'], []);

  const [result] = await db.insert(attractions).values({
    name: spot.name.trim(),
    city,
    cityCode: resolveCityCode(city),
    latitude: null,
    longitude: null,
    tags,
    description: spot.description.trim() || null,
    ticketPrice,
    aliases: null,
    status: AttractionStatus.PENDING,
    source: AttractionSource.LLM,
    priceSource: ticketPrice > 0 ? AttractionPriceSource.LLM_ESTIMATE : null,
    priceUpdatedAt: ticketPrice > 0 ? new Date() : null,
    verifiedAt: null,
    matchConfidence: null,
  });

  return Number(result.insertId);
}

async function mergeMatchedAttraction(
  match: AttractionMatchResult,
  input: MergeInput,
): Promise<number> {
  const db = getDb();
  const updates = buildMergedFields(match.row, input);
  updates.matchConfidence = match.confidence.toFixed(3);

  await db
    .update(attractions)
    .set(updates)
    .where(eq(attractions.id, match.row.id));

  return match.row.id;
}

/**
 * 同步路线景点到内容库：匹配则合并，未达阈值则 pending 新建，并写回 attractionId
 */
export async function syncAttractionsFromRouteDetail(
  routeDetail: { days: RouteDayPlan[] },
  options: {
    city: string;
    interestTags?: string[];
  },
): Promise<{ days: Array<RouteDayPlan & { attractions: RouteDayAttraction[] }> }> {
  const city = options.city?.trim() || '未知';
  const routeTags = options.interestTags ?? [];

  const days = await Promise.all(
    routeDetail.days.map(async (day) => ({
      ...day,
      attractions: await Promise.all(
        day.attractions.map(async (spot) => {
          const match = await resolveAttractionMatch(spot.name, city);

          let attractionId: number;
          if (match && match.confidence >= ATTRACTION_MATCH_MERGE_THRESHOLD) {
            attractionId = await mergeMatchedAttraction(match, { spot, routeTags });
          } else {
            attractionId = await insertPendingAttraction(spot, city, routeTags);
          }

          return {
            ...spot,
            attractionId,
          };
        }),
      ),
    })),
  );

  return { days };
}
