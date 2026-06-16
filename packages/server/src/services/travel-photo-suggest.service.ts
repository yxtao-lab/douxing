import { and, eq, inArray } from 'drizzle-orm';
import {
  haversineDistanceMeters,
  PHOTO_EXIF_GPS_HIGH_M,
  PHOTO_EXIF_GPS_MEDIUM_M,
  extractIsoCalendarDate,
  type RouteDayAttraction,
  type RouteDayPlan,
  type RouteDetailPayload,
  type TravelPhotoPlacementSuggestion,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { attractions } from '../db/schema/index.js';

interface RoutePoiCandidate {
  dayIndex: number;
  poiName: string;
  attractionId: number | null;
  latitude: number;
  longitude: number;
}

function normalizeRouteDetail(
  raw: RouteDetailPayload | Record<string, unknown> | null | undefined,
): RouteDayPlan[] {
  const detail = raw as RouteDetailPayload | null | undefined;
  return detail?.days ?? [];
}

function parseDayDate(day: RouteDayPlan | undefined): string | null {
  const fromCalendar = extractIsoCalendarDate(day?.calendarDate);
  if (fromCalendar) return fromCalendar;
  return extractIsoCalendarDate(day?.date);
}

function suggestDayIndexFromTakenAt(days: RouteDayPlan[], takenAt: Date): number | null {
  const takenDate = takenAt.toISOString().slice(0, 10);
  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const dayDate = parseDayDate(days[dayIndex]);
    if (dayDate && dayDate === takenDate) {
      return dayIndex;
    }
  }
  return null;
}

async function loadAttractionCoords(
  attractionIds: number[],
): Promise<Map<number, { latitude: number; longitude: number }>> {
  if (attractionIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({
      id: attractions.id,
      latitude: attractions.latitude,
      longitude: attractions.longitude,
    })
    .from(attractions)
    .where(inArray(attractions.id, attractionIds));

  const map = new Map<number, { latitude: number; longitude: number }>();
  for (const row of rows) {
    const lat = row.latitude != null ? Number(row.latitude) : NaN;
    const lon = row.longitude != null ? Number(row.longitude) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      map.set(row.id, { latitude: lat, longitude: lon });
    }
  }
  return map;
}

export async function collectRoutePoiCandidates(
  routeDetail: RouteDetailPayload | Record<string, unknown> | null | undefined,
): Promise<RoutePoiCandidate[]> {
  const days = normalizeRouteDetail(routeDetail);
  const missingIds: number[] = [];

  for (const day of days) {
    for (const spot of day.attractions ?? []) {
      if (
        spot.attractionId != null &&
        spot.latitude == null &&
        spot.longitude == null
      ) {
        missingIds.push(spot.attractionId);
      }
    }
  }

  const coordsByAttractionId = await loadAttractionCoords([...new Set(missingIds)]);
  const candidates: RoutePoiCandidate[] = [];

  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const day = days[dayIndex];
    for (const spot of day.attractions ?? []) {
      let latitude = spot.latitude;
      let longitude = spot.longitude;
      if (
        latitude == null &&
        longitude == null &&
        spot.attractionId != null
      ) {
        const coords = coordsByAttractionId.get(spot.attractionId);
        if (coords) {
          latitude = coords.latitude;
          longitude = coords.longitude;
        }
      }
      if (latitude == null || longitude == null) continue;
      candidates.push({
        dayIndex,
        poiName: spot.name,
        attractionId: spot.attractionId ?? null,
        latitude,
        longitude,
      });
    }
  }

  return candidates;
}

export function suggestPhotoPlacement(
  routeDetail: RouteDetailPayload | Record<string, unknown> | null | undefined,
  candidates: RoutePoiCandidate[],
  options: {
    latitude?: number | null;
    longitude?: number | null;
    takenAt?: Date | null;
  },
): TravelPhotoPlacementSuggestion {
  const days = normalizeRouteDetail(routeDetail);
  const none: TravelPhotoPlacementSuggestion = {
    dayIndex: null,
    poiName: null,
    attractionId: null,
    confidence: 'none',
    reason: 'none',
    distanceMeters: null,
  };

  let bestGps: {
    candidate: RoutePoiCandidate;
    distanceMeters: number;
  } | null = null;

  if (
    options.latitude != null &&
    options.longitude != null &&
    Number.isFinite(options.latitude) &&
    Number.isFinite(options.longitude)
  ) {
    for (const candidate of candidates) {
      const distanceMeters = haversineDistanceMeters(
        options.latitude,
        options.longitude,
        candidate.latitude,
        candidate.longitude,
      );
      if (!bestGps || distanceMeters < bestGps.distanceMeters) {
        bestGps = { candidate, distanceMeters };
      }
    }
  }

  const dayFromDate =
    options.takenAt != null ? suggestDayIndexFromTakenAt(days, options.takenAt) : null;

  if (bestGps && bestGps.distanceMeters <= PHOTO_EXIF_GPS_HIGH_M) {
    return {
      dayIndex: bestGps.candidate.dayIndex,
      poiName: bestGps.candidate.poiName,
      attractionId: bestGps.candidate.attractionId,
      confidence: dayFromDate === bestGps.candidate.dayIndex ? 'high' : 'high',
      reason: dayFromDate === bestGps.candidate.dayIndex ? 'gps_date' : 'gps',
      distanceMeters: Math.round(bestGps.distanceMeters),
    };
  }

  if (bestGps && bestGps.distanceMeters <= PHOTO_EXIF_GPS_MEDIUM_M) {
    return {
      dayIndex: bestGps.candidate.dayIndex,
      poiName: bestGps.candidate.poiName,
      attractionId: bestGps.candidate.attractionId,
      confidence: 'medium',
      reason: dayFromDate === bestGps.candidate.dayIndex ? 'gps_date' : 'gps',
      distanceMeters: Math.round(bestGps.distanceMeters),
    };
  }

  if (dayFromDate != null) {
    const day = days[dayFromDate];
    const firstSpot = day?.attractions?.[0] as RouteDayAttraction | undefined;
    return {
      dayIndex: dayFromDate,
      poiName: firstSpot?.name ?? null,
      attractionId: firstSpot?.attractionId ?? null,
      confidence: 'low',
      reason: 'date',
      distanceMeters: bestGps ? Math.round(bestGps.distanceMeters) : null,
    };
  }

  return none;
}

export function shouldAutoApplySuggestion(
  suggestion: TravelPhotoPlacementSuggestion,
): boolean {
  return suggestion.confidence === 'high' && suggestion.dayIndex != null;
}
