import {
  PoiCategory,
  type LocaleCode,
  type LodgingTier,
  type RouteDayAttraction,
  type RouteDayLodging,
  type RouteDayPlan,
  type RouteTransitSegment,
  type TravelIntentSnapshot,
  type TransportPreference,
} from '@douxing/shared';
import { CITY_CODE_MAP } from '../data/city-codes.js';
import { findCityPairTemplate } from '../data/city-pair-transit.js';
import type { GeneratedRouteDraft } from './route-generator.service.js';
import { geocodeByPlaceText, resolveCoordinatesFromAmap } from './amap-geocode.service.js';
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

function pickIntercityMode(
  preference?: TransportPreference | null,
  templateMode?: 'train' | 'flight',
): RouteTransitSegment['mode'] {
  if (preference === 'flight') return 'flight';
  if (preference === 'train' || preference === 'high_speed_rail') return 'train';
  if (preference === 'self_drive') return 'drive';
  return templateMode ?? 'train';
}

function buildIntercitySegment(
  fromCity: string,
  toCity: string,
  intent: TravelIntentSnapshot,
  locale: LocaleCode,
): RouteTransitSegment | null {
  const template = findCityPairTemplate(fromCity, toCity, intent.transportPreference ?? 'any');
  if (!template) return null;

  const mode = pickIntercityMode(intent.transportPreference, template.mode);
  const [depH, depM] = template.departureTime.split(':').map((v) => parseInt(v, 10));
  const startMinutes = depH * 60 + (depM || 0);
  const endMinutes = startMinutes + template.durationMinutes;

  const estimatedNote =
    locale === 'en-US'
      ? 'Reference duration only; demo booking link'
      : '参考耗时；演示订票链接';

  return {
    kind: 'intercity',
    mode,
    from: `${fromCity}${locale === 'en-US' ? ' Station' : '站'}`,
    to: `${toCity}${locale === 'en-US' ? ' Station' : '站'}`,
    time: formatTimeRange(startMinutes, endMinutes),
    durationMinutes: template.durationMinutes,
    cost: template.cost,
    bookingUrl: template.bookingUrl,
    estimated: true,
    description: estimatedNote,
  };
}

async function buildTransitLeg(
  from: LatLngPoint,
  to: LatLngPoint,
  fromLabel: string,
  toLabel: string,
  departMinutes: number,
  locale: LocaleCode,
): Promise<{ segment: RouteTransitSegment; arriveMinutes: number }> {
  const leg = await getTravelDuration(from, to);
  const arriveMinutes = departMinutes + leg.durationMinutes;
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
      description: leg.estimated
        ? locale === 'en-US'
          ? 'Estimated travel time'
          : '估算交通耗时'
        : undefined,
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

async function scheduleDayPois(
  city: string,
  spots: RouteDayAttraction[],
  lodging: RouteDayLodging,
  locale: LocaleCode,
): Promise<{ attractions: RouteDayAttraction[]; transit: RouteTransitSegment[]; warnings: string[] }> {
  const warnings: string[] = [];
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

  if (lodgingPoint && orderedSpots.length > 0) {
    const firstLeg = await buildTransitLeg(
      lodgingPoint,
      { latitude: orderedSpots[0]!.latitude!, longitude: orderedSpots[0]!.longitude! },
      lodging.name,
      orderedSpots[0]!.name,
      cursor,
      locale,
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
      );
      transit.push(leg.segment);
      cursor = leg.arriveMinutes;
    }

    const visitStart = cursor;
    const visitEnd = visitStart + DEFAULT_VISIT_MINUTES;
    if (visitEnd > 21 * 60) {
      warnings.push(
        locale === 'en-US'
          ? `Tight schedule at ${spot.name}`
          : `${spot.name} 排程偏晚，建议调整`,
      );
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
    );
    transit.push(returnLeg.segment);
  }

  for (const spot of missingCoords) {
    scheduled.push({
      ...spot,
      time: formatTimeRange(cursor, cursor + DEFAULT_VISIT_MINUTES),
    });
    cursor += DEFAULT_VISIT_MINUTES + 15;
    warnings.push(
      locale === 'en-US'
        ? `${spot.name} has no coordinates; order not optimized`
        : `${spot.name} 无坐标，未参与路径优化`,
    );
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
  const { intent, locale = 'zh-CN' } = options;
  const matchedCity = draft.matchedCity || intent.city || '当地';
  const dayCities = resolveDayCities(draft.routeDetail.days, intent, matchedCity);

  const enrichedDays: RouteDayPlan[] = [];

  for (let dayIndex = 0; dayIndex < draft.routeDetail.days.length; dayIndex += 1) {
    const day = draft.routeDetail.days[dayIndex]!;
    const city = dayCities[dayIndex] ?? matchedCity;
    const playPois = day.attractions.filter(isPlayPoi);
    const geocodedPois = await geocodePlayPois(city, playPois);
    const poiPointsForLodging: LatLngPoint[] = geocodedPois
      .filter(hasCoords)
      .map((s) => ({ latitude: s.latitude!, longitude: s.longitude! }));

    const lodging = await assignLodgingForDay(city, poiPointsForLodging, intent);

    const { attractions: scheduledPois, transit: localTransit, warnings } =
      await scheduleDayPois(city, playPois, lodging, locale);

    lodging.time = formatMinutesToTime(
      Math.min(21 * 60, cursorEndFromSpots(scheduledPois) + 30),
    );

    const transit: RouteTransitSegment[] = [...localTransit];

    if (dayIndex > 0) {
      const prevCity = dayCities[dayIndex - 1]!;
      if (prevCity !== city) {
        const intercity = buildIntercitySegment(prevCity, city, intent, locale);
        if (intercity) {
          transit.unshift(intercity);
        }
      }
    }

    enrichedDays.push({
      date: day.date,
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
