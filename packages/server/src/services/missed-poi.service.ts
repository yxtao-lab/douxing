/**
 * H7 · Step 33：错过景点补救 — 对比计划 vs 打卡/GPS，替补推荐，写入 regret 记忆
 */
import {
  ApiError,
  ApiMessageKey,
  CHECKIN_GEOFENCE_RADIUS_M,
  PoiCategory,
  haversineDistanceMeters,
  type CheckInInfo,
  type LocaleCode,
  type MissedPoiAlternative,
  type MissedPoiItem,
  type RagAttractionCandidate,
  type RouteDayAttraction,
  type RouteDayPlan,
  type RouteDetailPayload,
  type RouteMissedPoiAnalyzeResponse,
  type RouteMissedPoiRecordResponse,
  type TravelRouteInfo,
} from '@douxing/shared';
import { CITY_CODE_MAP } from '../data/city-codes.js';
import { retrieveAttractionsForPlanning } from './attraction-rag.service.js';
import { listRouteCheckInsPaginated } from './checkin.service.js';
import { matchesExcludePoiName } from './patch-route-day.service.js';
import {
  PetMemoryType,
  recallUserMemory,
  writeTripMemory,
} from './pet-memory.service.js';
import { getRouteById } from './route.service.js';

const KNOWN_CITIES = Object.keys(CITY_CODE_MAP);

export interface VisitMatchContext {
  visitedNames: string[];
  visitedAttractionIds: Set<number>;
  checkInPoints: Array<{ latitude: number; longitude: number; placeName?: string }>;
}

function isPlayPoi(spot: RouteDayAttraction): boolean {
  const type = spot.poiType ?? PoiCategory.ATTRACTION;
  return type !== PoiCategory.HOTEL && type !== PoiCategory.TRANSPORT;
}

function parseTimeRangeEnd(timeRange?: string): number | null {
  if (!timeRange) return null;
  const endPart = timeRange.split('-')[1]?.trim();
  if (!endPart) return null;
  const [h, m] = endPart.split(':').map((v) => parseInt(v, 10));
  if (!Number.isFinite(h)) return null;
  return h * 60 + (m || 0);
}

function detectCityInText(text?: string): string | null {
  if (!text) return null;
  for (const city of KNOWN_CITIES) {
    if (text.includes(city)) return city;
  }
  return null;
}

function resolveRouteCity(route: TravelRouteInfo, days: RouteDayPlan[]): string | null {
  return (
    detectCityInText(route.name) ??
    detectCityInText(route.sourcePrompt ?? undefined) ??
    detectCityInText(days[0]?.title) ??
    detectCityInText(days[0]?.date) ??
    null
  );
}

function resolveCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function buildVisitMatchContext(checkIns: CheckInInfo[]): VisitMatchContext {
  const visitedNames: string[] = [];
  const visitedAttractionIds = new Set<number>();
  const checkInPoints: VisitMatchContext['checkInPoints'] = [];

  for (const item of checkIns) {
    const placeName = item.location?.placeName?.trim();
    if (placeName) visitedNames.push(placeName);
    if (item.attractionId != null && item.attractionId > 0) {
      visitedAttractionIds.add(item.attractionId);
    }
    if (item.location?.latitude != null && item.location?.longitude != null) {
      checkInPoints.push({
        latitude: item.location.latitude,
        longitude: item.location.longitude,
        placeName,
      });
    }
  }

  return {
    visitedNames: [...new Set(visitedNames)],
    visitedAttractionIds,
    checkInPoints,
  };
}

export function isPlannedPoiVisited(
  spot: RouteDayAttraction,
  ctx: VisitMatchContext,
): boolean {
  if (spot.attractionId != null && ctx.visitedAttractionIds.has(spot.attractionId)) {
    return true;
  }
  if (ctx.visitedNames.length > 0 && matchesExcludePoiName(spot.name, ctx.visitedNames)) {
    return true;
  }
  if (spot.latitude != null && spot.longitude != null && ctx.checkInPoints.length > 0) {
    for (const point of ctx.checkInPoints) {
      const distance = haversineDistanceMeters(
        point.latitude,
        point.longitude,
        spot.latitude,
        spot.longitude,
      );
      if (distance <= CHECKIN_GEOFENCE_RADIUS_M) {
        return true;
      }
    }
  }
  return false;
}

export function collectMissedPoisForDays(
  days: RouteDayPlan[],
  throughDayIndex: number,
  currentTimeMinutes: number,
  visitCtx: VisitMatchContext,
): MissedPoiItem[] {
  const missed: MissedPoiItem[] = [];

  for (let dayIndex = 0; dayIndex <= throughDayIndex && dayIndex < days.length; dayIndex += 1) {
    const day = days[dayIndex]!;
    const isPastDay = dayIndex < throughDayIndex;

    for (const spot of day.attractions.filter(isPlayPoi)) {
      if (isPlannedPoiVisited(spot, visitCtx)) continue;

      const endMinutes = parseTimeRangeEnd(spot.time);
      if (!isPastDay) {
        if (endMinutes == null) continue;
        if (endMinutes >= currentTimeMinutes) continue;
      }

      missed.push({
        name: spot.name,
        dayIndex,
        dayTitle: day.title,
        time: spot.time || undefined,
        attractionId: spot.attractionId,
        reason: isPastDay ? 'past_day' : 'scheduled_past',
      });
    }
  }

  return missed;
}

function scoreAlternativeForMissed(
  missed: MissedPoiItem,
  candidate: RagAttractionCandidate,
): number {
  let score = candidate.score;
  const haystack = [candidate.name, candidate.description ?? '', ...candidate.tags, ...candidate.aliases]
    .join(' ')
    .toLowerCase();
  const needle = missed.name.toLowerCase();
  if (candidate.name.includes(missed.name) || missed.name.includes(candidate.name)) {
    score += 8;
  }
  if (haystack.includes(needle)) score += 4;
  for (const tag of candidate.tags) {
    if (missed.name.includes(tag) || tag.includes(missed.name)) score += 2;
  }
  return score;
}

function buildAlternativesForMissed(
  missedList: MissedPoiItem[],
  candidates: RagAttractionCandidate[],
): MissedPoiAlternative[] {
  const usedIds = new Set<number>();
  const result: MissedPoiAlternative[] = [];

  for (const missed of missedList) {
    const ranked = candidates
      .filter((c) => !usedIds.has(c.id))
      .map((c) => ({ c, score: scoreAlternativeForMissed(missed, c) }))
      .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name, 'zh-CN'))
      .slice(0, 3);

    for (const { c } of ranked) {
      usedIds.add(c.id);
      result.push({
        id: c.id,
        name: c.name,
        tags: c.tags,
        description: c.description,
        score: c.score,
        forMissedPoi: missed.name,
      });
    }
  }

  return result;
}

function formatRegretContent(poiName: string, locale: LocaleCode): string {
  return locale === 'en-US'
    ? `Planned to visit ${poiName} but missed check-in`
    : `计划去${poiName}但未打卡`;
}

async function assertRouteOwner(routeId: number, userId: number) {
  const route = await getRouteById(routeId, userId, { recordView: false });
  if (!route) {
    throw new ApiError(ApiMessageKey.ROUTE_NOT_FOUND);
  }
  if (route.creatorId !== userId) {
    throw new ApiError(ApiMessageKey.ROUTE_FORBIDDEN);
  }
  return route;
}

async function loadExistingRegretKeys(userId: number, routeId: number): Promise<Set<string>> {
  const memories = await recallUserMemory(userId, {
    types: [PetMemoryType.REGRET],
    limit: 20,
  });
  const keys = new Set<string>();
  for (const m of memories) {
    const metaRouteId = m.metadata?.routeId;
    const poiName = m.metadata?.poiName;
    if (metaRouteId === routeId && typeof poiName === 'string' && poiName.trim()) {
      keys.add(poiName.trim());
    }
  }
  return keys;
}

export async function analyzeRouteMissedPois(input: {
  routeId: number;
  userId: number;
  dayIndex: number;
  currentTimeMinutes?: number;
  locale?: LocaleCode;
  includeAlternatives?: boolean;
  autoRecordRegrets?: boolean;
}): Promise<RouteMissedPoiAnalyzeResponse> {
  const locale = input.locale ?? 'zh-CN';
  const route = await assertRouteOwner(input.routeId, input.userId);
  const detail = route.routeDetail as RouteDetailPayload | null | undefined;
  const days = detail?.days;
  if (!days || days.length === 0) {
    throw new ApiError(ApiMessageKey.ROUTE_NO_VALID_NODES);
  }

  const throughDayIndex = Math.min(Math.max(input.dayIndex, 0), days.length - 1);
  const currentTimeMinutes = input.currentTimeMinutes ?? resolveCurrentTimeMinutes();

  const checkins = await listRouteCheckInsPaginated(input.routeId, input.userId, 1, 200);
  const visitCtx = buildVisitMatchContext(checkins.items);
  const missed = collectMissedPoisForDays(days, throughDayIndex, currentTimeMinutes, visitCtx);
  const city = resolveRouteCity(route, days);

  let alternatives: MissedPoiAlternative[] = [];
  if (input.includeAlternatives !== false && missed.length > 0 && city) {
    const plannedNames = days.flatMap((day) =>
      day.attractions.filter(isPlayPoi).map((spot) => spot.name),
    );
    const candidates = await retrieveAttractionsForPlanning({
      city,
      themes: route.interestTags ?? [],
      prompt: missed.map((m) => m.name).join('、'),
      excludeNames: [...plannedNames, ...visitCtx.visitedNames],
      boostNames: missed.map((m) => m.name),
      limit: Math.min(missed.length * 4, 24),
    });
    alternatives = buildAlternativesForMissed(missed, candidates);
  }

  let recordedMemoryIds: number[] | undefined;
  if (input.autoRecordRegrets && missed.length > 0) {
    const recordResult = await recordMissedPoiRegrets({
      routeId: input.routeId,
      userId: input.userId,
      locale,
      items: missed.map((m) => ({ name: m.name, dayIndex: m.dayIndex })),
    });
    recordedMemoryIds = recordResult.memoryIds;
  }

  return {
    routeId: input.routeId,
    city,
    missed,
    alternatives,
    recordedMemoryIds,
  };
}

export async function recordMissedPoiRegrets(input: {
  routeId: number;
  userId: number;
  locale?: LocaleCode;
  items: Array<{ name: string; dayIndex: number }>;
}): Promise<RouteMissedPoiRecordResponse> {
  const locale = input.locale ?? 'zh-CN';
  await assertRouteOwner(input.routeId, input.userId);

  const existing = await loadExistingRegretKeys(input.userId, input.routeId);
  const memoryIds: number[] = [];
  const skipped: string[] = [];

  for (const item of input.items) {
    const name = item.name.trim();
    if (!name) continue;
    if (existing.has(name)) {
      skipped.push(name);
      continue;
    }

    const id = await writeTripMemory({
      userId: input.userId,
      memoryType: PetMemoryType.REGRET,
      content: formatRegretContent(name, locale),
      importance: 8,
      metadata: {
        poiName: name,
        routeId: input.routeId,
        dayIndex: item.dayIndex,
        source: 'h7_missed_poi',
      },
    });
    if (id) {
      memoryIds.push(id);
      existing.add(name);
    }
  }

  return { memoryIds, skipped };
}
