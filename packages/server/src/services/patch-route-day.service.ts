/**
 * Phase 3 / C7-b Step 5：局部修改指定天 POI（避免整段重生成）
 */
import {
  PoiCategory,
  type LocaleCode,
  type RouteDayPlan,
  type TravelIntentSnapshot,
} from '@douxing/shared';
import type { GeneratedRouteDraft } from './route-generator.service.js';
import { retrieveAttractionsForPlanning } from './attraction-rag.service.js';
import { enrichRouteDraft } from './route-enricher.service.js';
import { validateRouteDraft } from './validate-route.service.js';
import { retrievePlaybooksForPlanning } from './playbook-rag.service.js';

export interface PatchRouteDayInput {
  draft: GeneratedRouteDraft;
  /** 未传时若含 excludeNames 则自动定位含该 POI 的天 */
  dayIndex?: number;
  intent: TravelIntentSnapshot;
  locale?: LocaleCode;
  /** 替换为更轻松（减少 POI） */
  relaxed?: boolean;
  /** 排除 POI 名称 */
  excludeNames?: string[];
  /** 追加 prompt 约束 */
  prompt?: string;
  /** Agent Tool 链：仅改 POI，不跑 Enricher/校验（由 graph 后续 enrich_route → validate_route） */
  skipFinalize?: boolean;
}

const RELAXED_MAX_POIS = 2;

type RouteSpot = RouteDayPlan['attractions'][number];

function isPlayPoiSpot(spot: RouteSpot): boolean {
  const type = spot.poiType ?? PoiCategory.ATTRACTION;
  return type !== PoiCategory.HOTEL && type !== PoiCategory.TRANSPORT;
}

export function matchesExcludePoiName(spotName: string, excludeNames: string[]): boolean {
  const trimmed = spotName.trim();
  return excludeNames.some((ex) => {
    const target = ex.trim();
    if (!target) return false;
    return trimmed.includes(target) || target.includes(trimmed);
  });
}

/** 定位需排除 POI 所在天（0-based） */
export function resolveDayIndexForExclusion(
  draft: GeneratedRouteDraft,
  excludeNames: string[],
): number | undefined {
  if (excludeNames.length === 0) return undefined;
  for (let dayIndex = 0; dayIndex < draft.routeDetail.days.length; dayIndex += 1) {
    const day = draft.routeDetail.days[dayIndex]!;
    for (const spot of day.attractions) {
      if (isPlayPoiSpot(spot) && matchesExcludePoiName(spot.name, excludeNames)) {
        return dayIndex;
      }
    }
  }
  return undefined;
}

function resolvePatchDayIndex(
  draft: GeneratedRouteDraft,
  input: PatchRouteDayInput,
): number | undefined {
  if (input.dayIndex != null) return input.dayIndex;
  if (input.excludeNames?.length) {
    return resolveDayIndexForExclusion(draft, input.excludeNames);
  }
  return undefined;
}

function buildReplacementSpot(
  candidate: Awaited<ReturnType<typeof retrieveAttractionsForPlanning>>[number],
): RouteSpot {
  return {
    attractionId: candidate.id,
    name: candidate.name,
    time: '',
    cost: candidate.ticketPrice,
    description: candidate.description ?? candidate.name,
    poiType:
      candidate.category === 'restaurant' ? PoiCategory.RESTAURANT : PoiCategory.ATTRACTION,
    latitude: candidate.latitude ?? undefined,
    longitude: candidate.longitude ?? undefined,
  };
}

export async function patchRouteDay(
  input: PatchRouteDayInput,
): Promise<GeneratedRouteDraft> {
  const { draft, intent, locale = 'zh-CN' } = input;
  const dayIndex = resolvePatchDayIndex(draft, input);
  const days = draft.routeDetail.days.map((d) => ({
    ...d,
    attractions: d.attractions.map((s) => ({ ...s })),
  }));

  if (dayIndex == null || dayIndex < 0 || dayIndex >= days.length) {
    return draft;
  }

  const city = intent.city ?? draft.matchedCity;
  const needsRagCandidates =
    !input.relaxed
    && (Boolean(input.excludeNames?.length) || /小众|换.*景点/.test(input.prompt ?? ''));

  let ragCandidates: Awaited<ReturnType<typeof retrieveAttractionsForPlanning>> = [];
  if (needsRagCandidates && process.env.DATABASE_URL) {
    ragCandidates = await retrieveAttractionsForPlanning({
      city,
      themes: intent.themes,
      prompt: input.prompt ?? '',
      days: 1,
      excludeNames: input.excludeNames,
    });
  }

  const day = days[dayIndex]!;
  const usedNames = new Set<string>();
  days.forEach((d, idx) => {
    if (idx === dayIndex) return;
    for (const s of d.attractions) {
      if (isPlayPoiSpot(s)) {
        usedNames.add(s.name.trim());
      }
    }
  });

  if (input.relaxed) {
    const kept = day.attractions.filter(isPlayPoiSpot).slice(0, RELAXED_MAX_POIS);
    const structural = day.attractions.filter((s) => !isPlayPoiSpot(s));
    day.attractions = [...kept, ...structural];
  } else if (input.excludeNames?.length) {
    const structural = day.attractions.filter((s) => !isPlayPoiSpot(s));
    const playSpots = day.attractions.filter(isPlayPoiSpot);
    const kept = playSpots.filter((s) => !matchesExcludePoiName(s.name, input.excludeNames!));
    const removedCount = playSpots.length - kept.length;
    const replacements: RouteSpot[] = [];

    if (removedCount > 0) {
      for (const candidate of ragCandidates) {
        if (usedNames.has(candidate.name.trim())) continue;
        if (matchesExcludePoiName(candidate.name, input.excludeNames!)) continue;
        replacements.push(buildReplacementSpot(candidate));
        usedNames.add(candidate.name.trim());
        if (replacements.length >= removedCount) break;
      }
    }

    day.attractions = [...kept, ...replacements, ...structural];
  } else if (ragCandidates.length > 0 && /小众|换.*景点/.test(input.prompt ?? '')) {
    const maxSlots = Math.max(day.attractions.filter(isPlayPoiSpot).length, 3);
    const structural = day.attractions.filter((s) => !isPlayPoiSpot(s));
    const nextSpots: RouteSpot[] = [];
    for (const candidate of ragCandidates) {
      if (usedNames.has(candidate.name.trim())) continue;
      nextSpots.push(buildReplacementSpot(candidate));
      if (nextSpots.length >= maxSlots) break;
    }
    if (nextSpots.length > 0) {
      day.attractions = [...nextSpots, ...structural];
    }
  }

  const patched: GeneratedRouteDraft = {
    ...draft,
    routeDetail: { days },
  };

  if (input.skipFinalize) {
    return patched;
  }

  const playbooks = await retrievePlaybooksForPlanning({
    city,
    themes: intent.themes,
    prompt: input.prompt,
  });

  const enriched = await enrichRouteDraft(patched, {
    intent,
    locale,
    playbooks,
  });

  const validated = validateRouteDraft(enriched, {
    locale,
    ragCandidates,
    autoFix: true,
  });

  return validated.draft;
}

/** 导出游玩 POI 名称列表（用于 Step 5 局部修改断言） */
export function listPlayPoiNamesForDay(
  draft: GeneratedRouteDraft,
  dayIndex: number,
): string[] {
  const day = draft.routeDetail.days[dayIndex];
  if (!day) return [];
  return day.attractions.filter(isPlayPoiSpot).map((s) => s.name.trim());
}
