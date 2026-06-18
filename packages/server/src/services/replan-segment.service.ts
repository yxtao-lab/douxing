/**
 * H8 · Step 31：行中局部重规划 — 基于 GPS + 剩余 POI 重算当日剩余段
 */
import {
  ApiError,
  ApiMessageKey,
  PoiCategory,
  RouteStatus,
  type AgentToolTraceEntry,
  type LocaleCode,
  type RouteDayAttraction,
  type RouteDayLodging,
  type RouteDayPlan,
  type RouteDetailPayload,
  type RouteReplanPreviewResponse,
  type RouteReplanSegmentPayload,
  type RouteTransitSegment,
  type TravelRouteInfo,
  resolveRouteDayCalendarDate,
} from '@douxing/shared';
import { CITY_CODE_MAP } from '../data/city-codes.js';
import { formatMinutesToTime } from './amap-direction.service.js';
import { getRouteById, updateDraftRoute } from './route.service.js';
import { scheduleRemainingPoisFromGps } from './route-enricher.service.js';
import { getOpenHoursByAttractionIds } from './attraction.service.js';
import { retrievePlaybooksForPlanning } from './playbook-rag.service.js';
import { matchesExcludePoiName } from './patch-route-day.service.js';
import { listRouteCheckInsPaginated } from './checkin.service.js';
import { previewReplanViaTransitAgent } from './agent-transit-client.service.js';

const KNOWN_CITIES = Object.keys(CITY_CODE_MAP);

export interface ReplanSegmentContext {
  /** 0-based 天索引 */
  dayIndex: number;
  latitude: number;
  longitude: number;
  /** 当前时刻（分钟，0=00:00）；未传则按已访问 POI / 默认 14:00 */
  currentTimeMinutes?: number;
  /** 已访问 POI 名称（模糊匹配） */
  visitedPoiNames?: string[];
  /** 显式指定剩余 POI（优先于 visitedPoiNames / 时间推断） */
  remainingPoiNames?: string[];
  gpsLabel?: string;
}

export interface ReplanSegmentReorderItem {
  name: string;
  previousOrder: number;
  newOrder: number;
}

export interface ReplanSegmentDiff {
  skippedPoiNames: string[];
  reordered: ReplanSegmentReorderItem[];
}

export interface ReplanSegmentResult {
  routeId: number;
  dayIndex: number;
  /** 合并已访问 + 重排剩余后的当日计划 */
  day: RouteDayPlan;
  segment: {
    attractions: RouteDayAttraction[];
    transit: RouteTransitSegment[];
    warnings: string[];
  };
  diff: ReplanSegmentDiff;
}

const DEFAULT_REPLAN_START_MINUTES = 14 * 60;

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

function matchesPoiName(spotName: string, targetNames: string[]): boolean {
  return matchesExcludePoiName(spotName, targetNames);
}

function resolveRemainingPois(
  day: RouteDayPlan,
  context: ReplanSegmentContext,
): RouteDayAttraction[] {
  const playPois = day.attractions.filter(isPlayPoi);

  if (context.remainingPoiNames && context.remainingPoiNames.length > 0) {
    return playPois.filter((spot) => matchesPoiName(spot.name, context.remainingPoiNames!));
  }

  if (context.visitedPoiNames && context.visitedPoiNames.length > 0) {
    return playPois.filter((spot) => !matchesPoiName(spot.name, context.visitedPoiNames!));
  }

  const cutoff = context.currentTimeMinutes ?? DEFAULT_REPLAN_START_MINUTES;
  return playPois.filter((spot) => {
    const endMinutes = parseTimeRangeEnd(spot.time);
    return endMinutes == null || endMinutes >= cutoff;
  });
}

function resolveVisitedPois(
  day: RouteDayPlan,
  remaining: RouteDayAttraction[],
): RouteDayAttraction[] {
  const remainingNames = new Set(remaining.map((spot) => spot.name));
  return day.attractions.filter((spot) => isPlayPoi(spot) && !remainingNames.has(spot.name));
}

function buildReorderDiff(
  previousRemaining: RouteDayAttraction[],
  rescheduled: RouteDayAttraction[],
): ReplanSegmentDiff {
  const prevIndex = new Map(previousRemaining.map((spot, index) => [spot.name, index]));
  const reordered: ReplanSegmentReorderItem[] = [];

  rescheduled.forEach((spot, newOrder) => {
    const previousOrder = prevIndex.get(spot.name);
    if (previousOrder != null && previousOrder !== newOrder) {
      reordered.push({ name: spot.name, previousOrder, newOrder });
    }
  });

  const rescheduledNames = new Set(rescheduled.map((spot) => spot.name));
  const skippedPoiNames = previousRemaining
    .map((spot) => spot.name)
    .filter((name) => !rescheduledNames.has(name));

  return { skippedPoiNames, reordered };
}

function detectCityInText(text?: string): string | null {
  if (!text) return null;
  for (const city of KNOWN_CITIES) {
    if (text.includes(city)) return city;
  }
  return null;
}

function resolveDayCity(day: RouteDayPlan, matchedCity: string): string {
  return detectCityInText(day.title) ?? detectCityInText(day.date) ?? matchedCity;
}

function defaultLodging(city: string, locale: LocaleCode): RouteDayLodging {
  return {
    name: locale === 'en-US' ? `${city} hotel` : `${city}酒店`,
    area: city,
  };
}

export async function replanSegment(input: {
  routeId: number;
  userId: number;
  locale?: LocaleCode;
  context: ReplanSegmentContext;
}): Promise<ReplanSegmentResult> {
  const locale = input.locale ?? 'zh-CN';
  const route = await getRouteById(input.routeId, input.userId, { recordView: false });
  if (!route) {
    throw new ApiError(ApiMessageKey.ROUTE_NOT_FOUND);
  }

  const detail = route.routeDetail as RouteDetailPayload | null | undefined;
  const days = detail?.days;
  if (!days || days.length === 0) {
    throw new ApiError(ApiMessageKey.ROUTE_NO_VALID_NODES);
  }

  const dayIndex = input.context.dayIndex;
  if (dayIndex < 0 || dayIndex >= days.length) {
    throw new ApiError(ApiMessageKey.VALIDATION_ERROR);
  }

  const day = days[dayIndex]!;
  const remaining = resolveRemainingPois(day, input.context);
  if (remaining.length === 0) {
    throw new ApiError(ApiMessageKey.ROUTE_NO_VALID_NODES);
  }

  const visited = resolveVisitedPois(day, remaining);
  const matchedCity = detail?.matchedCity ?? route.name ?? '当地';
  const city = resolveDayCity(day, matchedCity);
  const calendarDate = resolveRouteDayCalendarDate(day, dayIndex, null);
  const lodging = day.lodging ?? defaultLodging(city, locale);
  const startMinutes = input.context.currentTimeMinutes ?? DEFAULT_REPLAN_START_MINUTES;

  const openHoursMap = await getOpenHoursByAttractionIds(
    remaining
      .map((spot) => spot.attractionId)
      .filter((id): id is number => id != null && id > 0),
  );

  const playbooks = await retrievePlaybooksForPlanning({
    city,
    themes: [],
  });

  const segment = await scheduleRemainingPoisFromGps({
    city,
    remainingSpots: remaining,
    lodging,
    gps: {
      latitude: input.context.latitude,
      longitude: input.context.longitude,
    },
    gpsLabel: input.context.gpsLabel,
    startMinutes,
    locale,
    calendarDate,
    dayTitle: day.title,
    openHoursMap,
    playbooks,
  });

  const diff = buildReorderDiff(remaining, segment.attractions);
  const updatedDay: RouteDayPlan = {
    ...day,
    attractions: [...visited, ...segment.attractions],
    transit: segment.transit,
    warnings: segment.warnings.length > 0 ? segment.warnings : day.warnings,
  };

  if (lodging.time == null && segment.attractions.length > 0) {
    const lastSpot = segment.attractions.at(-1);
    const lastEnd = parseTimeRangeEnd(lastSpot?.time);
    if (lastEnd != null) {
      updatedDay.lodging = {
        ...lodging,
        time: formatMinutesToTime(Math.min(21 * 60 - 1, lastEnd + 30)),
      };
    }
  }

  return {
    routeId: input.routeId,
    dayIndex,
    day: updatedDay,
    segment,
    diff,
  };
}

function resolveCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
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

export async function enrichReplanContext(
  routeId: number,
  userId: number,
  context: ReplanSegmentContext,
  locale: LocaleCode,
): Promise<ReplanSegmentContext> {
  const enriched: ReplanSegmentContext = { ...context };

  if (!enriched.visitedPoiNames?.length && !enriched.remainingPoiNames?.length) {
    const checkins = await listRouteCheckInsPaginated(routeId, userId, 1, 100);
    const names = checkins.items
      .map((item) => item.location?.placeName?.trim())
      .filter((name): name is string => Boolean(name));
    if (names.length > 0) {
      enriched.visitedPoiNames = [...new Set(names)];
    }
  }

  if (enriched.currentTimeMinutes == null) {
    enriched.currentTimeMinutes = resolveCurrentTimeMinutes();
  }

  if (!enriched.gpsLabel) {
    enriched.gpsLabel = locale === 'en-US' ? 'Current location' : '当前位置';
  }

  return enriched;
}

function toSegmentPayload(result: ReplanSegmentResult): RouteReplanSegmentPayload {
  return {
    routeId: result.routeId,
    dayIndex: result.dayIndex,
    day: result.day,
    segment: result.segment,
    diff: result.diff,
  };
}

export async function previewRouteReplan(input: {
  routeId: number;
  userId: number;
  locale?: LocaleCode;
  context: ReplanSegmentContext;
  useTransitAgent?: boolean;
}): Promise<RouteReplanPreviewResponse> {
  const locale = input.locale ?? 'zh-CN';
  const route = await assertRouteOwner(input.routeId, input.userId);
  const context = await enrichReplanContext(input.routeId, input.userId, input.context, locale);

  let preview: ReplanSegmentResult;
  let toolTrace: AgentToolTraceEntry[] | undefined;

  if (input.useTransitAgent !== false) {
    try {
      const agentResult = await previewReplanViaTransitAgent({
        routeId: input.routeId,
        userId: input.userId,
        locale,
        context,
      });
      preview = agentResult.preview;
      toolTrace = agentResult.toolTrace;
    } catch (err) {
      console.warn('[replan-segment] transit_agent 降级为本地 replan:', err);
      preview = await replanSegment({
        routeId: input.routeId,
        userId: input.userId,
        locale,
        context,
      });
    }
  } else {
    preview = await replanSegment({
      routeId: input.routeId,
      userId: input.userId,
      locale,
      context,
    });
  }

  return {
    preview: toSegmentPayload(preview),
    canApply: route.status === RouteStatus.DRAFT,
    toolTrace,
  };
}

export async function applyRouteReplan(input: {
  routeId: number;
  userId: number;
  locale?: LocaleCode;
  context: ReplanSegmentContext;
}): Promise<TravelRouteInfo> {
  const locale = input.locale ?? 'zh-CN';
  const route = await assertRouteOwner(input.routeId, input.userId);

  if (route.status !== RouteStatus.DRAFT) {
    throw new ApiError(ApiMessageKey.ROUTE_DRAFT_ONLY_EDIT);
  }

  const context = await enrichReplanContext(input.routeId, input.userId, input.context, locale);
  const result = await replanSegment({
    routeId: input.routeId,
    userId: input.userId,
    locale,
    context,
  });

  const detail = (route.routeDetail ?? { days: [] }) as unknown as RouteDetailPayload;
  const newDays = [...detail.days];
  newDays[result.dayIndex] = result.day;

  const updated = await updateDraftRoute(input.routeId, input.userId, {
    routeDetail: {
      ...detail,
      days: newDays,
    },
  });

  if (!updated) {
    throw new ApiError(ApiMessageKey.ROUTE_NOT_FOUND);
  }

  return updated;
}
