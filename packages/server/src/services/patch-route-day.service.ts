/**
 * Phase 3：局部修改指定天 POI（避免整段重生成）
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
  dayIndex: number;
  intent: TravelIntentSnapshot;
  locale?: LocaleCode;
  /** 替换为更轻松（减少 POI） */
  relaxed?: boolean;
  /** 排除 POI 名称 */
  excludeNames?: string[];
  /** 追加 prompt 约束 */
  prompt?: string;
}

const RELAXED_MAX_POIS = 2;

export async function patchRouteDay(
  input: PatchRouteDayInput,
): Promise<GeneratedRouteDraft> {
  const { draft, dayIndex, intent, locale = 'zh-CN' } = input;
  const days = draft.routeDetail.days.map((d) => ({
    ...d,
    attractions: d.attractions.map((s) => ({ ...s })),
  }));

  if (dayIndex < 0 || dayIndex >= days.length) {
    return draft;
  }

  const city = intent.city ?? draft.matchedCity;
  const ragCandidates = await retrieveAttractionsForPlanning({
    city,
    themes: intent.themes,
    prompt: input.prompt ?? '',
    days: 1,
    excludeNames: input.excludeNames,
  });

  const day = days[dayIndex]!;
  const usedNames = new Set<string>();
  days.forEach((d, idx) => {
    if (idx === dayIndex) return;
    for (const s of d.attractions) {
      if (s.poiType !== PoiCategory.HOTEL && s.poiType !== PoiCategory.TRANSPORT) {
        usedNames.add(s.name.trim());
      }
    }
  });

  if (input.relaxed) {
    const kept = day.attractions
      .filter((s) => {
        const type = s.poiType ?? PoiCategory.ATTRACTION;
        return type !== PoiCategory.HOTEL && type !== PoiCategory.TRANSPORT;
      })
      .slice(0, RELAXED_MAX_POIS);
    day.attractions = kept;
  } else if (ragCandidates.length > 0) {
    const maxSlots = Math.max(
      day.attractions.filter((s) => s.poiType !== PoiCategory.HOTEL).length,
      3,
    );
    const nextSpots: RouteDayPlan['attractions'] = [];
    for (const c of ragCandidates) {
      if (usedNames.has(c.name.trim())) continue;
      if (input.excludeNames?.includes(c.name.trim())) continue;
      nextSpots.push({
        attractionId: c.id,
        name: c.name,
        time: '',
        cost: c.ticketPrice,
        description: c.description ?? c.name,
        poiType:
          c.category === 'restaurant' ? PoiCategory.RESTAURANT : PoiCategory.ATTRACTION,
        latitude: c.latitude ?? undefined,
        longitude: c.longitude ?? undefined,
      });
      if (nextSpots.length >= maxSlots) break;
    }
    if (nextSpots.length > 0) {
      day.attractions = nextSpots;
    }
  }

  const playbooks = await retrievePlaybooksForPlanning({
    city,
    themes: intent.themes,
    prompt: input.prompt,
  });

  const patched: GeneratedRouteDraft = {
    ...draft,
    routeDetail: { days },
  };

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
