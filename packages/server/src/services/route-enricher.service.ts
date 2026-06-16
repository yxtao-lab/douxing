import {
  ATTRACTION_MATCH_MERGE_THRESHOLD,
  PoiCategory,
  type AttractionOpenHours,
  type LocaleCode,
  type LodgingTier,
  type RouteDayAttraction,
  type RouteDayLodging,
  type RouteDayPlan,
  type RouteTransitSegment,
  type TravelIntentSnapshot,
  checkVisitOpenHours,
  formatEnricherWarning,
  formatPlaybookTransitDescription,
  normalizeRouteDayPlans,
  parseWeekdayFromCalendarDate,
  resolveRouteDayCalendarDate,
} from '@douxing/shared';
import { CITY_CODE_MAP } from '../data/city-codes.js';
import type { GeneratedRouteDraft } from './route-generator.service.js';
import { geocodeByPlaceText, resolveCoordinatesFromAmap, searchHotelsByArea } from './amap-geocode.service.js';
import {
  DEFAULT_DAY_START_MINUTES,
  DEFAULT_VISIT_MINUTES,
  formatMinutesToTime,
  formatTimeRange,
  getTravelDuration,
  optimizePoiOrderFromDepot,
  optimizeVisitOrder,
  type LatLngPoint,
} from './amap-direction.service.js';
import { formatIntentConstraintsForEnricher } from './travel-intent.service.js';
import { retrieveHotelsForLodging } from './attraction-rag.service.js';
import { getOpenHoursByAttractionIds } from './attraction.service.js';
import { resolveAttractionMatch } from './attraction-sync.service.js';
import { resolveIntercityTransitSegment } from './intercity-transit.service.js';
import {
  findPlaybookSegmentHint,
  isScenicClusterDay,
  type MatchedRoutePlaybook,
} from './playbook-rag.service.js';

const KNOWN_CITIES = Object.keys(CITY_CODE_MAP);

const LODGING_TIER_COST: Record<Exclude<LodgingTier, 'any'>, number> = {
  budget: 180,
  comfort: 380,
  luxury: 880,
};

const LODGING_SEARCH_KEYWORDS: Record<Exclude<LodgingTier, 'any'>, string[]> = {
  budget: ['如家酒店', '7天连锁酒店', '汉庭酒店'],
  comfort: ['全季酒店', '亚朵酒店', '桔子酒店'],
  luxury: ['五星级酒店', '万豪酒店', '希尔顿酒店'],
};

export interface EnrichRouteOptions {
  intent: TravelIntentSnapshot;
  locale?: LocaleCode;
  /** H9-4：玩法动线检索结果 */
  playbooks?: MatchedRoutePlaybook[];
}

function isPlayPoi(spot: RouteDayAttraction): boolean {
  const type = spot.poiType ?? PoiCategory.ATTRACTION;
  return type !== PoiCategory.HOTEL && type !== PoiCategory.TRANSPORT;
}

function hasCoords(spot: { latitude?: number; longitude?: number }): spot is {
  latitude: number;
  longitude: number;
} {
  return (
    spot.latitude != null &&
    spot.longitude != null &&
    !(spot.latitude === 0 && spot.longitude === 0)
  );
}

function resolveLodgingTier(intent: TravelIntentSnapshot): Exclude<LodgingTier, 'any'> {
  if (intent.lodgingTier && intent.lodgingTier !== 'any') {
    return intent.lodgingTier;
  }
  if (intent.themes.includes('经济') || intent.themes.includes('穷游')) return 'budget';
  if (intent.themes.includes('奢华') || intent.themes.includes('豪华')) return 'luxury';
  return 'comfort';
}

function centroid(points: LatLngPoint[]): LatLngPoint | null {
  if (points.length === 0) return null;
  const sum = points.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 },
  );
  return {
    latitude: sum.latitude / points.length,
    longitude: sum.longitude / points.length,
  };
}

async function geocodePlayPois(city: string, spots: RouteDayAttraction[]): Promise<RouteDayAttraction[]> {
  const result: RouteDayAttraction[] = [];
  for (const spot of spots) {
    if (hasCoords(spot)) {
      result.push(spot);
      continue;
    }
    const geo = await resolveCoordinatesFromAmap(spot.name, city);
    if (geo) {
      result.push({ ...spot, latitude: geo.latitude, longitude: geo.longitude });
    } else {
      result.push(spot);
    }
  }
  return result;
}

async function searchHotelViaAmap(
  city: string,
  tier: Exclude<LodgingTier, 'any'>,
  area?: string | null,
): Promise<RouteDayLodging | null> {
  const tierKeyword =
    tier === 'budget' ? '经济型酒店' : tier === 'luxury' ? '豪华酒店' : '酒店';
  const pois = await searchHotelsByArea(city, {
    area: area ?? undefined,
    tierKeyword,
    limit: 6,
  });

  if (pois.length > 0) {
    const best = pois[0]!;
    return {
      name: best.name,
      area: area ?? undefined,
      tier,
      cost: LODGING_TIER_COST[tier],
      latitude: best.latitude,
      longitude: best.longitude,
      description: best.address?.trim() || best.name,
      source: 'amap_poi',
    };
  }

  const keywords = LODGING_SEARCH_KEYWORDS[tier];
  const areaPrefix = area?.trim() ? `${area.trim()}` : city;

  for (const keyword of keywords) {
    const query = area?.trim() ? `${areaPrefix}${keyword}` : `${city}${keyword}`;
    const geo = await geocodeByPlaceText(query, city);
    if (geo) {
      return {
        name: query,
        area: area ?? undefined,
        tier,
        cost: LODGING_TIER_COST[tier],
        latitude: geo.latitude,
        longitude: geo.longitude,
        description: area ? `${area}附近${keyword}` : keyword,
        source: 'amap_geocode',
      };
    }
  }
  return null;
}

async function assignLodgingForDay(
  city: string,
  poiPoints: LatLngPoint[],
  intent: TravelIntentSnapshot,
): Promise<RouteDayLodging> {
  const tier = resolveLodgingTier(intent);
  const area = intent.lodgingArea;
  const center = centroid(poiPoints);

  const hotelCandidates = await retrieveHotelsForLodging({
    city,
    area,
    tier,
    themes: intent.themes,
    limit: 16,
  });

  const withCoords = hotelCandidates.filter(
    (hotel) => hotel.latitude != null && hotel.longitude != null,
  );

  if (withCoords.length > 0) {
    let best = withCoords[0]!;
    let bestScore = -Infinity;

    for (const hotel of withCoords) {
      let score = hotel.score;
      const lat = hotel.latitude!;
      const lng = hotel.longitude!;

      if (center) {
        const dist =
          Math.abs(lat - center.latitude) + Math.abs(lng - center.longitude);
        score += Math.max(0, 8 - dist * 100);
      }

      if (poiPoints.length > 0) {
        const travelSum = poiPoints.reduce((sum, poi) => {
          return (
            sum +
            Math.abs(lat - poi.latitude) +
            Math.abs(lng - poi.longitude)
          );
        }, 0);
        score += Math.max(0, 10 - travelSum * 50);
      }

      if (score > bestScore) {
        bestScore = score;
        best = hotel;
      }
    }

    return {
      name: best.name,
      area: area ?? undefined,
      tier,
      cost: best.ticketPrice > 0 ? best.ticketPrice : LODGING_TIER_COST[tier],
      latitude: best.latitude!,
      longitude: best.longitude!,
      description: best.description ?? best.name,
      attractionId: best.id,
      source: 'content_library',
    };
  }

  const fromAmap = await searchHotelViaAmap(city, tier, area);
  if (fromAmap) {
    return { ...fromAmap, source: 'amap_geocode' };
  }

  const fallback: RouteDayLodging = {
    name: area ? `${area}附近酒店` : `${city}市中心酒店`,
    area: area ?? undefined,
    tier,
    cost: LODGING_TIER_COST[tier],
    description: area ? `推荐入住${area}附近` : `推荐入住${city}市区`,
    source: 'fallback',
  };
  const geo = await resolveCoordinatesFromAmap(fallback.name, city);
  if (geo) {
    return { ...fallback, latitude: geo.latitude, longitude: geo.longitude };
  }
  return fallback;
}

function detectCityInText(text: string): string | null {
  for (const city of KNOWN_CITIES) {
    if (text.includes(city)) return city;
  }
  return null;
}

function resolveDayCities(
  days: RouteDayPlan[],
  intent: TravelIntentSnapshot,
  matchedCity: string,
): string[] {
  if (intent.cities && intent.cities.length > 0) {
    return days.map(
      (_, index) => intent.cities![index] ?? intent.cities![intent.cities!.length - 1]!,
    );
  }

  const primary = intent.city ?? matchedCity;
  return days.map((day) => detectCityInText(day.title) ?? detectCityInText(day.date) ?? primary);
}

async function buildTransitLeg(
  from: LatLngPoint,
  to: LatLngPoint,
  fromLabel: string,
  toLabel: string,
  departMinutes: number,
  locale: LocaleCode,
  options?: {
    playbooks?: MatchedRoutePlaybook[];
    scenicCluster?: boolean;
  },
): Promise<{ segment: RouteTransitSegment; arriveMinutes: number }> {
  const segmentHint = options?.playbooks?.length
    ? findPlaybookSegmentHint(options.playbooks, fromLabel, toLabel)
    : null;

  const leg = await getTravelDuration(from, to, {
    preferredMode: segmentHint?.mode,
    scenicCluster: options?.scenicCluster && !segmentHint,
  });
  const arriveMinutes = departMinutes + leg.durationMinutes;

  let description: string | undefined;
  if (segmentHint) {
    description = formatPlaybookTransitDescription(segmentHint.reasonKey, locale, {
      scope: segmentHint.scope,
    });
  } else if (leg.estimated) {
    description = locale === 'en-US' ? 'Estimated travel time' : '估算交通耗时';
  }

  return {
    arriveMinutes,
    segment: {
      kind: 'local',
      mode: leg.mode,
      from: fromLabel,
      to: toLabel,
      time: formatTimeRange(departMinutes, arriveMinutes),
      durationMinutes: leg.durationMinutes,
      estimated: leg.estimated,
      description,
    },
  };
}

function parseTimeRangeEnd(timeRange?: string): number | null {
  if (!timeRange) return null;
  const endPart = timeRange.split('-')[1]?.trim();
  if (!endPart) return null;
  const [h, m] = endPart.split(':').map((v) => parseInt(v, 10));
  if (!Number.isFinite(h)) return null;
  return h * 60 + (m || 0);
}

function cursorEndFromSpots(spots: RouteDayAttraction[]): number {
  const lastTime = spots.at(-1)?.time;
  return parseTimeRangeEnd(lastTime) ?? DEFAULT_DAY_START_MINUTES + 12 * 60;
}

/** H9-3：排程前按名称关联内容库，以便读取 openHours */
async function linkPlayPoisToLibrary(
  city: string,
  spots: RouteDayAttraction[],
): Promise<RouteDayAttraction[]> {
  const linked: RouteDayAttraction[] = [];

  for (const spot of spots) {
    if (spot.attractionId != null && spot.attractionId > 0) {
      linked.push(spot);
      continue;
    }
    if (!isPlayPoi(spot)) {
      linked.push(spot);
      continue;
    }

    try {
      const match = await resolveAttractionMatch(spot.name, city);
      if (match && match.confidence >= ATTRACTION_MATCH_MERGE_THRESHOLD) {
        linked.push({ ...spot, attractionId: match.row.id });
        continue;
      }
    } catch (err) {
      console.warn(
        '[route-enricher] 景点匹配失败:',
        spot.name,
        err instanceof Error ? err.message : err,
      );
    }

    linked.push(spot);
  }

  return linked;
}

function appendOpenHoursWarning(
  warnings: string[],
  spot: RouteDayAttraction,
  visitStart: number,
  visitEnd: number,
  openHours: AttractionOpenHours,
  weekday: number | null,
  locale: LocaleCode,
): void {
  const result = checkVisitOpenHours(visitStart, visitEnd, openHours, weekday);
  if (!result.conflict || !result.kind) return;

  const key =
    result.kind === 'closed_day'
      ? 'closedDay'
      : result.kind === 'before_open'
        ? 'beforeOpen'
        : 'afterClose';

  warnings.push(
    formatEnricherWarning(key, locale, {
      name: spot.name,
      openMinutes: result.openMinutes,
      closeMinutes: result.closeMinutes,
    }),
  );
}

async function scheduleDayPois(
  city: string,
  spots: RouteDayAttraction[],
  lodging: RouteDayLodging,
  locale: LocaleCode,
  options: {
    dayIndex: number;
    calendarDate: string;
    dayTitle?: string;
    openHoursMap: Map<number, AttractionOpenHours>;
    playbooks?: MatchedRoutePlaybook[];
  },
): Promise<{ attractions: RouteDayAttraction[]; transit: RouteTransitSegment[]; warnings: string[] }> {
  const warnings: string[] = [];
  const weekday = parseWeekdayFromCalendarDate(options.calendarDate);
  const openHoursMap = options.openHoursMap;
  const playbooks = options.playbooks ?? [];
  const geocoded = await geocodePlayPois(city, spots);
  const withCoords = geocoded.filter(hasCoords);
  const missingCoords = geocoded.filter((s) => !hasCoords(s));

  const transit: RouteTransitSegment[] = [];
  let cursor = DEFAULT_DAY_START_MINUTES;
  const scheduled: RouteDayAttraction[] = [];

  if (withCoords.length === 0) {
    for (const spot of geocoded) {
      scheduled.push({
        ...spot,
        time: spot.time || formatTimeRange(cursor, cursor + DEFAULT_VISIT_MINUTES),
      });
      cursor += DEFAULT_VISIT_MINUTES + 15;
    }
    return { attractions: scheduled, transit, warnings };
  }

  const poiPoints: LatLngPoint[] = withCoords.map((s) => ({
    latitude: s.latitude!,
    longitude: s.longitude!,
  }));

  const lodgingPoint = hasLodgingCoords(lodging)
    ? { latitude: lodging.latitude!, longitude: lodging.longitude! }
    : null;

  const order = lodgingPoint
    ? await optimizePoiOrderFromDepot(lodgingPoint, poiPoints)
    : await optimizeVisitOrder(poiPoints);
  const orderedSpots = order.map((idx) => withCoords[idx]!);
  const scenicCluster = isScenicClusterDay(
    playbooks,
    [...geocoded.map((s) => s.name), ...missingCoords.map((s) => s.name)],
    options.dayTitle ?? city,
  );
  const legOptions = { playbooks, scenicCluster };

  if (lodgingPoint && orderedSpots.length > 0) {
    const firstLeg = await buildTransitLeg(
      lodgingPoint,
      { latitude: orderedSpots[0]!.latitude!, longitude: orderedSpots[0]!.longitude! },
      lodging.name,
      orderedSpots[0]!.name,
      cursor,
      locale,
      legOptions,
    );
    transit.push(firstLeg.segment);
    cursor = firstLeg.arriveMinutes;
  }

  for (let i = 0; i < orderedSpots.length; i += 1) {
    const spot = orderedSpots[i]!;
    if (i > 0) {
      const prev = orderedSpots[i - 1]!;
      const leg = await buildTransitLeg(
        { latitude: prev.latitude!, longitude: prev.longitude! },
        { latitude: spot.latitude!, longitude: spot.longitude! },
        prev.name,
        spot.name,
        cursor,
        locale,
        legOptions,
      );
      transit.push(leg.segment);
      cursor = leg.arriveMinutes;
    }

    const visitStart = cursor;
    const visitEnd = visitStart + DEFAULT_VISIT_MINUTES;
    if (visitEnd > 21 * 60) {
      warnings.push(formatEnricherWarning('lateSchedule', locale, { name: spot.name }));
    }
    if (spot.attractionId != null) {
      const openHours = openHoursMap.get(spot.attractionId);
      if (openHours) {
        appendOpenHoursWarning(warnings, spot, visitStart, visitEnd, openHours, weekday, locale);
      }
    }
    scheduled.push({
      ...spot,
      time: formatTimeRange(visitStart, visitEnd),
    });
    cursor = visitEnd + 15;
  }

  if (lodgingPoint && orderedSpots.length > 0) {
    const lastSpot = orderedSpots[orderedSpots.length - 1]!;
    const returnLeg = await buildTransitLeg(
      { latitude: lastSpot.latitude!, longitude: lastSpot.longitude! },
      lodgingPoint,
      lastSpot.name,
      lodging.name,
      cursor,
      locale,
      legOptions,
    );
    transit.push(returnLeg.segment);
  }

  for (const spot of missingCoords) {
    scheduled.push({
      ...spot,
      time: formatTimeRange(cursor, cursor + DEFAULT_VISIT_MINUTES),
    });
    cursor += DEFAULT_VISIT_MINUTES + 15;
    warnings.push(formatEnricherWarning('noCoords', locale, { name: spot.name }));
  }

  return { attractions: scheduled, transit, warnings };
}

function hasLodgingCoords(lodging: RouteDayLodging): lodging is RouteDayLodging & {
  latitude: number;
  longitude: number;
} {
  return hasCoords(lodging);
}

/**
 * H9 Enricher：补全住宿、交通段与时刻表；过滤 LLM 内 hotel/transport POI
 */
export async function enrichRouteDraft(
  draft: GeneratedRouteDraft,
  options: EnrichRouteOptions,
): Promise<GeneratedRouteDraft> {
  const { intent, locale = 'zh-CN', playbooks = [] } = options;
  const matchedCity = draft.matchedCity || intent.city || '当地';
  const normalizedDays = normalizeRouteDayPlans(draft.routeDetail.days, {
    startDate: intent.startDate,
    locale,
  });
  const dayCities = resolveDayCities(normalizedDays, intent, matchedCity);

  const enrichedDays: RouteDayPlan[] = [];
  const lodgingByCity = new Map<string, RouteDayLodging>();

  for (let dayIndex = 0; dayIndex < normalizedDays.length; dayIndex += 1) {
    const day = normalizedDays[dayIndex]!;
    const calendarDate = resolveRouteDayCalendarDate(day, dayIndex, intent.startDate);
    const city = dayCities[dayIndex] ?? matchedCity;
    const playPois = await linkPlayPoisToLibrary(city, day.attractions.filter(isPlayPoi));
    const geocodedPois = await geocodePlayPois(city, playPois);
    const poiPointsForLodging: LatLngPoint[] = geocodedPois
      .filter(hasCoords)
      .map((s) => ({ latitude: s.latitude!, longitude: s.longitude! }));

    const prevCity = dayIndex > 0 ? dayCities[dayIndex - 1] : null;
    const cityChanged = prevCity != null && prevCity !== city;
    let lodging: RouteDayLodging;

    if (!cityChanged && lodgingByCity.has(city)) {
      lodging = { ...lodgingByCity.get(city)! };
    } else {
      lodging = await assignLodgingForDay(city, poiPointsForLodging, intent);
      lodgingByCity.set(city, lodging);
    }

    const openHoursMap = await getOpenHoursByAttractionIds(
      playPois
        .map((spot) => spot.attractionId)
        .filter((id): id is number => id != null && id > 0),
    );

    const { attractions: scheduledPois, transit: localTransit, warnings } =
      await scheduleDayPois(city, playPois, lodging, locale, {
        dayIndex,
        calendarDate,
        dayTitle: day.title,
        openHoursMap,
        playbooks,
      });

    lodging.time = formatMinutesToTime(
      Math.min(21 * 60, cursorEndFromSpots(scheduledPois) + 30),
    );

    const transit: RouteTransitSegment[] = [...localTransit];

    if (dayIndex > 0) {
      const prevCity = dayCities[dayIndex - 1]!;
      if (prevCity !== city) {
        const intercity = await resolveIntercityTransitSegment(prevCity, city, {
          dayIndex,
          dayDate: calendarDate,
          startDate: intent.startDate,
          transportPreference: intent.transportPreference,
          locale,
        });
        if (intercity) {
          transit.unshift(intercity);
        }
      }
    }

    enrichedDays.push({
      date: day.date,
      calendarDate,
      title: day.title,
      attractions: scheduledPois,
      lodging,
      transit,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  }

  if (process.env.NODE_ENV === 'development') {
    const constraints = formatIntentConstraintsForEnricher(intent);
    if (constraints) {
      console.log('[route-enricher] 约束块:', constraints.split('\n')[0]);
    }
  }

  return {
    ...draft,
    routeDetail: { days: enrichedDays },
  };
}
