import { eq, and, inArray } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { attractions } from '../db/schema/attractions.js';
import {
  AttractionCategory,
  AttractionSource,
  AttractionStatus,
  PoiCategory,
} from '@douxing/shared';
import type { LocaleCode, LodgingTier, RagAttractionCandidate } from '@douxing/shared';
import {
  formatPlanVariantSuffix,
  formatRagRouteDescription,
  formatRagRouteName,
  formatRouteDayDate,
  formatRouteDayTitle,
} from '@douxing/shared';
import { resolveCityCode } from '../data/city-codes.js';
import type { GeneratedRouteDraft } from './route-generator.service.js';
import type { TravelIntentSnapshot } from '@douxing/shared';

const DEFAULT_SLOTS_PER_DAY = 3;
const MAX_CANDIDATES = 30;
const MAX_HOTEL_CANDIDATES = 24;
const DAY_TIME_SLOTS = ['09:00-11:30', '14:00-16:30', '18:00-20:00'];

const LODGING_TIER_PRICE: Record<Exclude<LodgingTier, 'any'>, [number, number]> = {
  budget: [0, 280],
  comfort: [220, 650],
  luxury: [500, 99999],
};

export interface HotelRetrievalInput {
  city: string;
  area?: string | null;
  tier?: LodgingTier | null;
  themes?: string[];
  prompt?: string;
  limit?: number;
}

export interface RagRetrievalInput {
  city?: string | null;
  themes?: string[];
  prompt?: string;
  days?: number | null;
  limit?: number;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, '').toLowerCase();
}

function extractPromptKeywords(prompt: string): string[] {
  const chunks = prompt
    .split(/[，,。；;、\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  return [...new Set(chunks)].slice(0, 12);
}

function scoreRow(
  row: typeof attractions.$inferSelect,
  themes: string[],
  keywords: string[],
): number {
  let score = 0;
  const tagSet = new Set(row.tags);
  const themeSet = new Set(themes);

  for (const tag of row.tags) {
    if (themeSet.has(tag)) score += 4;
  }
  for (const theme of themes) {
    for (const tag of row.tags) {
      if (tag.includes(theme) || theme.includes(tag)) score += 2;
    }
  }

  const haystack = [
    row.name,
    row.description ?? '',
    ...(row.aliases ?? []),
    ...row.tags,
  ]
    .join(' ')
    .toLowerCase();

  for (const kw of keywords) {
    const k = kw.toLowerCase();
    if (k.length < 2) continue;
    if (haystack.includes(k)) score += 2;
    if (row.name.includes(kw)) score += 3;
  }

  if (row.category === AttractionCategory.ATTRACTION) score += 1;
  if (row.source === AttractionSource.SEED || row.source === AttractionSource.MANUAL) {
    score += 1;
  }

  return score;
}

function scoreHotelRow(
  row: typeof attractions.$inferSelect,
  themes: string[],
  keywords: string[],
  tier?: LodgingTier | null,
  area?: string | null,
): number {
  let score = scoreRow(row, themes, keywords);

  if (tier && tier !== 'any') {
    const [minPrice, maxPrice] = LODGING_TIER_PRICE[tier];
    if (row.ticketPrice >= minPrice && row.ticketPrice <= maxPrice) {
      score += 4;
    }
    for (const tag of row.tags) {
      if (tag.includes('经济') && tier === 'budget') score += 2;
      if (tag.includes('舒适') && tier === 'comfort') score += 2;
      if ((tag.includes('豪华') || tag.includes('五星')) && tier === 'luxury') score += 2;
    }
  }

  if (area?.trim()) {
    const keyword = area.trim();
    if (
      row.name.includes(keyword) ||
      (row.description ?? '').includes(keyword) ||
      row.tags.some((tag) => tag.includes(keyword))
    ) {
      score += 6;
    }
  }

  if (row.category === AttractionCategory.HOTEL) score += 2;
  return score;
}

function toCandidate(
  row: typeof attractions.$inferSelect,
  score: number,
): RagAttractionCandidate {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    tags: row.tags,
    description: row.description,
    ticketPrice: row.ticketPrice,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    aliases: row.aliases ?? [],
    score,
  };
}

/** 按城市 + 主题/关键词从内容库检索候选 POI（轻量 RAG） */
export async function retrieveAttractionsForPlanning(
  input: RagRetrievalInput,
): Promise<RagAttractionCandidate[]> {
  const city = input.city?.trim();
  if (!city) return [];

  const cityCode = resolveCityCode(city);
  const themes = input.themes ?? [];
  const keywords = extractPromptKeywords(input.prompt ?? '');
  const limit = Math.min(
    Math.max(input.limit ?? (input.days ?? 3) * 5, 8),
    MAX_CANDIDATES,
  );

  const db = getDb();
  const rows = await db
    .select()
    .from(attractions)
    .where(
      and(
        eq(attractions.status, AttractionStatus.ACTIVE),
        eq(attractions.cityCode, cityCode),
        inArray(attractions.category, [
          AttractionCategory.ATTRACTION,
          AttractionCategory.RESTAURANT,
        ]),
      ),
    );

  if (rows.length === 0) {
    const byCityName = await db
      .select()
      .from(attractions)
      .where(and(eq(attractions.status, AttractionStatus.ACTIVE), eq(attractions.city, city)));
    if (byCityName.length === 0) return [];
    return rankCandidates(byCityName, themes, keywords, limit);
  }

  return rankCandidates(rows, themes, keywords, limit);
}

function rankHotelCandidates(
  rows: typeof attractions.$inferSelect[],
  themes: string[],
  keywords: string[],
  tier: LodgingTier | null | undefined,
  area: string | null | undefined,
  limit: number,
): RagAttractionCandidate[] {
  return rows
    .map((row) => toCandidate(row, scoreHotelRow(row, themes, keywords, tier, area)))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, limit);
}

/** H9-2：按城市 + 区域/档次/主题从内容库检索酒店候选 */
export async function retrieveHotelsForLodging(
  input: HotelRetrievalInput,
): Promise<RagAttractionCandidate[]> {
  const city = input.city?.trim();
  if (!city) return [];

  const cityCode = resolveCityCode(city);
  const themes = input.themes ?? [];
  const keywords = extractPromptKeywords(input.prompt ?? input.area ?? '');
  const limit = Math.min(Math.max(input.limit ?? 12, 4), MAX_HOTEL_CANDIDATES);

  const db = getDb();
  const rows = await db
    .select()
    .from(attractions)
    .where(
      and(
        eq(attractions.status, AttractionStatus.ACTIVE),
        eq(attractions.category, AttractionCategory.HOTEL),
        eq(attractions.cityCode, cityCode),
      ),
    );

  if (rows.length === 0) {
    const byCityName = await db
      .select()
      .from(attractions)
      .where(
        and(
          eq(attractions.status, AttractionStatus.ACTIVE),
          eq(attractions.category, AttractionCategory.HOTEL),
          eq(attractions.city, city),
        ),
      );
    if (byCityName.length === 0) return [];
    return rankHotelCandidates(byCityName, themes, keywords, input.tier, input.area, limit);
  }

  return rankHotelCandidates(rows, themes, keywords, input.tier, input.area, limit);
}

function rankCandidates(
  rows: typeof attractions.$inferSelect[],
  themes: string[],
  keywords: string[],
  limit: number,
): RagAttractionCandidate[] {
  return rows
    .map((row) => toCandidate(row, scoreRow(row, themes, keywords)))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, limit);
}

/** 格式化为 LLM 可读的候选 POI 块 */
export function formatRagContextForLlm(candidates: RagAttractionCandidate[]): string {
  if (candidates.length === 0) return '';

  const compact = candidates.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    tags: c.tags,
    ticketPrice: c.ticketPrice,
    description: (c.description ?? '').slice(0, 80),
    latitude: c.latitude,
    longitude: c.longitude,
  }));

  return [
    '【内容库候选 POI — poiType=attraction 时必须优先从中选用】',
    '- name 必须与下列 name 完全一致，禁止自造未在库中的景区名',
    '- cost 使用 ticketPrice；坐标使用 latitude/longitude',
    JSON.stringify(compact),
  ].join('\n');
}

function findCandidateByName(
  name: string,
  candidates: RagAttractionCandidate[],
): RagAttractionCandidate | null {
  const normalized = normalizeName(name);
  if (!normalized) return null;

  for (const c of candidates) {
    if (normalizeName(c.name) === normalized) return c;
    for (const alias of c.aliases) {
      if (normalizeName(alias) === normalized) return c;
    }
  }

  for (const c of candidates) {
    const cn = normalizeName(c.name);
    if (cn.includes(normalized) || normalized.includes(cn)) return c;
  }

  return null;
}

function shouldLinkSpot(poiType?: string): boolean {
  if (!poiType || poiType === PoiCategory.ATTRACTION) return true;
  return poiType === PoiCategory.RESTAURANT || poiType === PoiCategory.HOTEL;
}

/** 将生成结果中的景区节点与 RAG 候选对齐（名称/坐标/票价/ID） */
export function applyRagToRouteDraft(
  draft: GeneratedRouteDraft,
  candidates: RagAttractionCandidate[],
): GeneratedRouteDraft & { ragMatchedCount: number; ragCandidateCount: number } {
  if (candidates.length === 0) {
    return { ...draft, ragMatchedCount: 0, ragCandidateCount: 0 };
  }

  let matched = 0;
  const routeDetail = {
    days: draft.routeDetail.days.map((day) => ({
      ...day,
      attractions: day.attractions.map((spot) => {
        if (!shouldLinkSpot(spot.poiType)) return { ...spot };

        const hit = findCandidateByName(spot.name, candidates);
        if (!hit) return { ...spot };

        matched += 1;
        return {
          ...spot,
          attractionId: hit.id,
          name: hit.name,
          cost: hit.ticketPrice,
          description: spot.description?.trim() ? spot.description : (hit.description ?? hit.name),
          poiType: hit.category === AttractionCategory.RESTAURANT
            ? PoiCategory.RESTAURANT
            : PoiCategory.ATTRACTION,
          latitude: hit.latitude ?? spot.latitude,
          longitude: hit.longitude ?? spot.longitude,
        };
      }),
    })),
  };

  return {
    ...draft,
    routeDetail,
    ragMatchedCount: matched,
    ragCandidateCount: candidates.length,
  };
}

/** 模板降级：纯内容库组装路线（候选不足时返回 null） */
export function buildRouteFromRagCatalog(
  intent: TravelIntentSnapshot,
  candidates: RagAttractionCandidate[],
  prompt: string,
  variantIndex = 0,
  variantKey?: string,
  locale: LocaleCode = 'zh-CN',
): GeneratedRouteDraft | null {
  const days = intent.days ?? 3;
  const city = intent.city;
  if (!city || candidates.length < days) return null;

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const offset = (variantIndex * 2) % Math.max(sorted.length, 1);
  const rotated = [...sorted.slice(offset), ...sorted.slice(0, offset)];
  const used = new Set<number>();
  const dayPlans: GeneratedRouteDraft['routeDetail']['days'] = [];

  const suffix = formatPlanVariantSuffix(variantKey, locale);

  for (let d = 0; d < days; d++) {
    const spots: GeneratedRouteDraft['routeDetail']['days'][0]['attractions'] = [];
    for (const c of rotated) {
      if (used.has(c.id)) continue;
      if (spots.length >= DEFAULT_SLOTS_PER_DAY) break;
      used.add(c.id);
      spots.push({
        attractionId: c.id,
        name: c.name,
        time: DAY_TIME_SLOTS[spots.length] ?? '10:00-12:00',
        cost: c.ticketPrice,
        description: c.description ?? c.name,
        poiType: c.category === AttractionCategory.RESTAURANT
          ? PoiCategory.RESTAURANT
          : PoiCategory.ATTRACTION,
        latitude: c.latitude ?? undefined,
        longitude: c.longitude ?? undefined,
      });
    }
    if (spots.length === 0) return null;
    dayPlans.push({
      date: formatRouteDayDate(d, locale),
      title: formatRouteDayTitle({ city, variantKey, dayIndex: d, locale }),
      attractions: spots,
    });
  }

  const themes = intent.themes.length > 0 ? intent.themes : ['休闲'];
  const budgetRange =
    intent.budgetMin != null && intent.budgetMax != null
      ? `${intent.budgetMin}-${intent.budgetMax}`
      : intent.budget ?? '1500-4000';

  const promptSnippet = `${prompt.slice(0, 36)}${prompt.length > 36 ? '…' : ''}`;
  return {
    name: formatRagRouteName({ city, days, variantKey, locale }),
    description: formatRagRouteDescription({ suffix, promptSnippet, locale }),
    budgetRange,
    days,
    interestTags: themes,
    routeDetail: { days: dayPlans },
    unlockPrice: 9.9,
    matchedCity: city,
    isAiGenerated: true,
  };
}
