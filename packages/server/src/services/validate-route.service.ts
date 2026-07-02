/**
 * Phase 1：路线质量评估与自动修正
 */
import { PoiCategory, type LocaleCode, type RagAttractionCandidate } from '@douxing/shared';
import type { GeneratedRouteDraft } from './route-generator.service.js';
import {
  formatValidatorWarning,
  type ValidatorWarningKey,
} from '@douxing/shared';
import { geoSimilarity, tagJaccardSimilarity } from '../utils/mmr-rank.util.js';
import { matchRagCandidateBySpotName } from './attraction-rag.service.js';

export interface ValidateRouteOptions {
  locale?: LocaleCode;
  ragCandidates?: RagAttractionCandidate[];
  autoFix?: boolean;
}

export interface ValidateRouteResult {
  draft: GeneratedRouteDraft;
  warnings: string[];
  fixedCount: number;
}

const MAX_SINGLE_DAY_GEO_SPAN = 0.35;

function collectPlayPoiNames(draft: GeneratedRouteDraft): Map<string, number[]> {
  const map = new Map<string, number[]>();
  draft.routeDetail.days.forEach((day, dayIndex) => {
    for (const spot of day.attractions) {
      const type = spot.poiType ?? PoiCategory.ATTRACTION;
      if (type === PoiCategory.HOTEL || type === PoiCategory.TRANSPORT) continue;
      const key = spot.name.trim();
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(dayIndex);
      map.set(key, list);
    }
  });
  return map;
}

function applyRagReplacementSpot(
  spot: GeneratedRouteDraft['routeDetail']['days'][0]['attractions'][0],
  replacement: RagAttractionCandidate,
): GeneratedRouteDraft['routeDetail']['days'][0]['attractions'][0] {
  return {
    ...spot,
    attractionId: replacement.id,
    name: replacement.name,
    cost: replacement.ticketPrice,
    description: spot.description?.trim()
      ? spot.description
      : (replacement.description ?? replacement.name),
    latitude: replacement.latitude ?? spot.latitude,
    longitude: replacement.longitude ?? spot.longitude,
  };
}

function findReplacementCandidate(
  excludeIds: Set<number>,
  excludeNames: Set<string>,
  candidates: RagAttractionCandidate[],
): RagAttractionCandidate | null {
  for (const c of candidates) {
    if (excludeIds.has(c.id)) continue;
    if (excludeNames.has(c.name.trim())) continue;
    return c;
  }
  return null;
}

/**
 * 优先按名称匹配 RAG 候选，失败时再取首个未占用候选。
 *
 * @param name - 当前 POI 名称
 * @param excludeIds - 已使用的 attractionId
 * @param excludeNames - 已使用的 POI 名称
 * @param candidates - RAG 白名单
 * @returns 可替换候选；无可用时为 `null`
 */
function resolveReplacementCandidate(
  name: string,
  excludeIds: Set<number>,
  excludeNames: Set<string>,
  candidates: RagAttractionCandidate[],
): RagAttractionCandidate | null {
  const matched = matchRagCandidateBySpotName(name, candidates);
  if (matched && !excludeIds.has(matched.id) && !excludeNames.has(matched.name.trim())) {
    return matched;
  }
  return findReplacementCandidate(excludeIds, excludeNames, candidates);
}

function dayGeoSpan(day: GeneratedRouteDraft['routeDetail']['days'][0]): number {
  const coords = day.attractions
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ latitude: s.latitude!, longitude: s.longitude! }));
  if (coords.length < 2) return 0;
  let maxSpan = 0;
  for (let i = 0; i < coords.length; i += 1) {
    for (let j = i + 1; j < coords.length; j += 1) {
      const dist =
        Math.abs(coords[i]!.latitude - coords[j]!.latitude) +
        Math.abs(coords[i]!.longitude - coords[j]!.longitude);
      maxSpan = Math.max(maxSpan, dist);
    }
  }
  return maxSpan;
}

export function validateRouteDraft(
  draft: GeneratedRouteDraft,
  options: ValidateRouteOptions = {},
): ValidateRouteResult {
  const locale = options.locale ?? 'zh-CN';
  const autoFix = options.autoFix ?? true;
  const candidates = options.ragCandidates ?? [];
  const warnings: string[] = [];
  let fixedCount = 0;

  const usedIds = new Set<number>();
  const usedNames = new Set<string>();
  const days = draft.routeDetail.days.map((day) => ({
    ...day,
    attractions: day.attractions.map((s) => ({ ...s })),
    warnings: day.warnings ? [...day.warnings] : undefined,
  }));

  const pushWarning = (key: ValidatorWarningKey, params: Record<string, string>) => {
    warnings.push(formatValidatorWarning(key, locale, params));
  };

  const pushDayWarning = (dayIndex: number, key: ValidatorWarningKey, params: Record<string, string>) => {
    const text = formatValidatorWarning(key, locale, params);
    warnings.push(text);
    const day = days[dayIndex];
    if (day) {
      day.warnings = [...(day.warnings ?? []), text];
    }
  };

  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const day = days[dayIndex]!;

    if (dayGeoSpan(day) > MAX_SINGLE_DAY_GEO_SPAN) {
      pushDayWarning(dayIndex, 'wideGeoSpan', { title: day.title });
    }

    if (day.lodging?.source === 'fallback') {
      pushDayWarning(dayIndex, 'lodgingFallback', { name: day.lodging.name });
    } else if (day.lodging?.source === 'amap_geocode' || day.lodging?.source === 'amap_poi') {
      pushDayWarning(dayIndex, 'lodgingUnverified', { name: day.lodging.name });
    }

    for (const segment of day.transit ?? []) {
      if (segment.estimated) {
        pushWarning('transitEstimated', {
          from: segment.from,
          to: segment.to,
        });
      }
    }

    for (let spotIndex = 0; spotIndex < day.attractions.length; spotIndex += 1) {
      const spot = day.attractions[spotIndex]!;
      const type = spot.poiType ?? PoiCategory.ATTRACTION;
      if (type === PoiCategory.HOTEL || type === PoiCategory.TRANSPORT) continue;

      const name = spot.name.trim();
      if (!name) continue;

      if (!spot.attractionId) {
        pushDayWarning(dayIndex, 'poiNotInLibrary', { name });
        if (autoFix && candidates.length > 0) {
          const replacement = resolveReplacementCandidate(name, usedIds, usedNames, candidates);
          if (replacement) {
            day.attractions[spotIndex] = applyRagReplacementSpot(spot, replacement);
            usedIds.add(replacement.id);
            usedNames.add(replacement.name.trim());
            fixedCount += 1;
            continue;
          }
        }
      }

      if (usedNames.has(name)) {
        pushDayWarning(dayIndex, 'duplicatePoi', { name });
        if (autoFix && candidates.length > 0) {
          const replacement = resolveReplacementCandidate(name, usedIds, usedNames, candidates);
          if (replacement) {
            day.attractions[spotIndex] = applyRagReplacementSpot(spot, replacement);
            usedIds.add(replacement.id);
            usedNames.add(replacement.name.trim());
            fixedCount += 1;
            continue;
          }
        }
      }

      if (spot.attractionId) usedIds.add(spot.attractionId);
      usedNames.add(name);
    }
  }

  return {
    draft: { ...draft, routeDetail: { days } },
    warnings,
    fixedCount,
  };
}

/** 检测候选列表内部多样性（调试用） */
export function scoreCandidateDiversity(
  candidates: RagAttractionCandidate[],
): number {
  if (candidates.length < 2) return 1;
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i]!;
      const b = candidates[j]!;
      const tagSim = tagJaccardSimilarity(a.tags, b.tags);
      const geoSim =
        a.latitude != null &&
        a.longitude != null &&
        b.latitude != null &&
        b.longitude != null
          ? geoSimilarity(
              { latitude: a.latitude, longitude: a.longitude },
              { latitude: b.latitude, longitude: b.longitude },
            )
          : 0;
      sum += 1 - Math.max(tagSim, geoSim);
      pairs += 1;
    }
  }
  return pairs === 0 ? 1 : sum / pairs;
}
