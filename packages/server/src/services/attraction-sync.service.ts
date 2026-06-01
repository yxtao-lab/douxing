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
import {
  shouldSyncSpotToAttractions,
  resolvePoiCategory,
  hasValidCoordinates,
  requiresCoordinatesForInsert,
  mapPoiCategoryToDbCategory,
  defaultTagsForCategory,
} from '../utils/poi-classifier.js';
import { resolveCoordinatesFromAmap } from './amap-geocode.service.js';
import { scheduleAttractionCoverEnrichment, enrichAttractionCoversForIds } from './attraction-image-enricher.service.js';

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

function coordFieldsFromSpot(spot: RouteDayAttraction): {
  latitude: string | null;
  longitude: string | null;
} {
  if (!hasValidCoordinates(spot)) {
    return { latitude: null, longitude: null };
  }
  return {
    latitude: String(spot.latitude),
    longitude: String(spot.longitude),
  };
}

function statusActiveOrPending() {
  return inArray(attractions.status, [AttractionStatus.ACTIVE, AttractionStatus.PENDING]);
}

/** 在库内解析 POI（含 active + pending，可按 category 限定） */
export async function resolveAttractionMatch(
  name: string,
  city?: string | null,
  category?: string | null,
): Promise<AttractionMatchResult | null> {
  const normalized = normalizeName(name);
  if (!normalized) return null;

  const db = getDb();
  const conditions = [statusActiveOrPending()];
  if (city?.trim()) {
    conditions.push(eq(attractions.city, city.trim()));
  }
  if (category?.trim()) {
    conditions.push(eq(attractions.category, mapPoiCategoryToDbCategory(category)));
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
  dbCategory: string;
}

function applyCoordinateMerge(
  existing: Attraction,
  spot: RouteDayAttraction,
  updates: Partial<typeof attractions.$inferInsert>,
) {
  if (!hasValidCoordinates(spot)) return;
  const hasExisting =
    existing.latitude != null &&
    existing.longitude != null &&
    !(Number(existing.latitude) === 0 && Number(existing.longitude) === 0);
  if (hasExisting && isTrustedSource(existing.source)) return;

  const coords = coordFieldsFromSpot(spot);
  if (!hasExisting) {
    updates.latitude = coords.latitude;
    updates.longitude = coords.longitude;
  }
}

/** 将 LLM/路线节点数据按来源策略合并到已有记录 */
function buildMergedFields(existing: Attraction, input: MergeInput) {
  const { spot, routeTags, dbCategory } = input;
  const incomingPrice = estimateTicketFromCost(spot.cost);
  const mergedTags = mergeUniqueStrings(
    existing.tags,
    defaultTagsForCategory(dbCategory, routeTags),
  );
  const mergedAliases = mergeAliases(existing.aliases, spot.name, existing.name);
  const mergedDescription = pickLongerDescription(existing.description, spot.description);

  const updates: Partial<typeof attractions.$inferInsert> = {
    tags: mergedTags,
    aliases: mergedAliases.length > 0 ? mergedAliases : existing.aliases,
    description: mergedDescription,
  };

  applyCoordinateMerge(existing, spot, updates);

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
  dbCategory: string,
): Promise<number> {
  const db = getDb();
  const ticketPrice = estimateTicketFromCost(spot.cost);
  const tags = mergeUniqueStrings(defaultTagsForCategory(dbCategory, routeTags), []);
  const coords = coordFieldsFromSpot(spot);

  const [result] = await db.insert(attractions).values({
    name: spot.name.trim(),
    category: dbCategory,
    city,
    cityCode: resolveCityCode(city),
    latitude: coords.latitude,
    longitude: coords.longitude,
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
 * 同步路线 POI 到内容库：仅具体景点/餐厅/酒店；笼统用餐不入库；景点需坐标
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
  const pendingCoverIds: number[] = [];

  const days = await Promise.all(
    routeDetail.days.map(async (day) => ({
      ...day,
      attractions: await Promise.all(
        day.attractions.map(async (spot) => {
          if (!shouldSyncSpotToAttractions(spot)) {
            return { ...spot };
          }

          const poiCategory = resolvePoiCategory(spot);
          const dbCategory = mapPoiCategoryToDbCategory(poiCategory);

          let workingSpot = await enrichSpotCoordinates(spot, city);

          const match = await resolveAttractionMatch(workingSpot.name, city, dbCategory);
          if (match && match.confidence >= ATTRACTION_MATCH_MERGE_THRESHOLD) {
            const attractionId = await mergeMatchedAttraction(match, {
              spot: workingSpot,
              routeTags,
              dbCategory,
            });
            if (!match.row.coverImageUrl) {
              pendingCoverIds.push(attractionId);
              scheduleAttractionCoverEnrichment(attractionId);
            }
            return {
              ...workingSpot,
              poiType: poiCategory,
              attractionId,
            };
          }

          if (requiresCoordinatesForInsert(poiCategory) && !hasValidCoordinates(workingSpot)) {
            console.warn(
              `[attraction-sync] 无坐标且未匹配，仍入库待补全: ${spot.name} (${city})`,
            );
          }

          const attractionId = await insertPendingAttraction(
            workingSpot,
            city,
            routeTags,
            dbCategory,
          );
          pendingCoverIds.push(attractionId);
          scheduleAttractionCoverEnrichment(attractionId);

          return {
            ...workingSpot,
            poiType: poiCategory,
            attractionId,
          };
        }),
      ),
    })),
  );

  if (pendingCoverIds.length > 0) {
    const { updated, skipped } = await enrichAttractionCoversForIds(pendingCoverIds, {
      delayMs: 120,
      maxCount: 24,
    });
    if (updated > 0) {
      console.log(`[attraction-sync] 封面补全 ${updated} 个，跳过 ${skipped} 个`);
    }
  }

  return { days };
}

/** 无坐标时尝试高德补全（place/text → geocode/geo） */
async function enrichSpotCoordinates(
  spot: RouteDayAttraction,
  city: string,
): Promise<RouteDayAttraction> {
  if (hasValidCoordinates(spot)) return spot;

  const geocoded = await resolveCoordinatesFromAmap(spot.name, city);
  if (!geocoded) return spot;

  return {
    ...spot,
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
  };
}
