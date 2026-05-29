import {
  formatIntercitySegmentDescription,
  type LocaleCode,
  type RouteTransitMode,
  type RouteTransitSegment,
  type TransportPreference,
} from '@douxing/shared';
import {
  getIntercityProvider,
  isIntercityTransitEnabled,
  type IntercityProvider,
} from '../config/intercity.js';
import { findCityPairTemplate } from '../data/city-pair-transit.js';
import {
  buildCatalogBookingUrl,
  findCatalogSchedule,
} from '../data/intercity-schedule-catalog.js';
import { resolveTrainStation } from '../data/intercity-stations.js';
import {
  buildIntercityCacheKey,
  getCachedIntercitySchedule,
  setCachedIntercitySchedule,
  type CachedIntercitySchedule,
} from './intercity-transit-cache.service.js';
import { queryJuheTrainSchedule } from './intercity-juhe.provider.js';

export interface IntercityScheduleQuery {
  fromCity: string;
  toCity: string;
  /** ISO YYYY-MM-DD */
  travelDate?: string | null;
  transportPreference?: TransportPreference | null;
  locale?: LocaleCode;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** 解析为 ISO 出行日期 */
export function resolveTravelDateIso(
  dayIndex: number,
  dayDate?: string | null,
  startDate?: string | null,
): string {
  const fromDay = dayDate?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (fromDay) {
    return `${fromDay[1]}-${fromDay[2]}-${fromDay[3]}`;
  }

  if (startDate?.trim()) {
    const iso = startDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const base = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`);
      if (!Number.isNaN(base.getTime())) {
        base.setDate(base.getDate() + dayIndex);
        return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`;
      }
    }
  }

  const fallback = new Date();
  fallback.setDate(fallback.getDate() + dayIndex + 1);
  return `${fallback.getFullYear()}-${pad2(fallback.getMonth() + 1)}-${pad2(fallback.getDate())}`;
}

function pickIntercityMode(
  preference: TransportPreference | null | undefined,
  mode: 'train' | 'flight',
): RouteTransitMode {
  if (preference === 'flight') return 'flight';
  if (preference === 'train' || preference === 'high_speed_rail') return 'train';
  if (preference === 'self_drive') return 'drive';
  return mode;
}

function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime}-${endTime}`;
}

function catalogToCached(
  entry: NonNullable<ReturnType<typeof findCatalogSchedule>>,
  travelDate: string,
): CachedIntercitySchedule {
  return {
    mode: entry.mode,
    scheduleNo: entry.scheduleNo,
    fromLabel: entry.fromStation,
    toLabel: entry.toStation,
    departureTime: entry.departureTime,
    arrivalTime: entry.arrivalTime,
    durationMinutes: entry.durationMinutes,
    cost: entry.cost,
    bookingUrl: buildCatalogBookingUrl(entry, travelDate),
    source: 'catalog',
    estimated: false,
  };
}

function templateToCached(
  fromCity: string,
  toCity: string,
  preference: TransportPreference | null | undefined,
): CachedIntercitySchedule | null {
  const template = findCityPairTemplate(fromCity, toCity, preference ?? 'any');
  if (!template) return null;

  const [depH, depM] = template.departureTime.split(':').map((v) => parseInt(v, 10));
  const startMinutes = depH * 60 + (depM || 0);
  const endMinutes = startMinutes + template.durationMinutes;
  const endH = Math.floor((endMinutes % (24 * 60)) / 60);
  const endM = endMinutes % 60;

  const fromStation =
    template.mode === 'train' ? resolveTrainStation(fromCity) : `${fromCity}机场`;
  const toStation =
    template.mode === 'train' ? resolveTrainStation(toCity) : `${toCity}机场`;

  return {
    mode: template.mode,
    scheduleNo: '—',
    fromLabel: fromStation,
    toLabel: toStation,
    departureTime: template.departureTime,
    arrivalTime: `${pad2(endH)}:${pad2(endM)}`,
    durationMinutes: template.durationMinutes,
    cost: template.cost,
    bookingUrl: template.bookingUrl,
    source: 'template',
    estimated: true,
  };
}

async function queryFromProvider(
  provider: IntercityProvider,
  query: IntercityScheduleQuery,
  travelDate: string,
): Promise<CachedIntercitySchedule | null> {
  const { fromCity, toCity, transportPreference } = query;

  if (provider === 'template') {
    return templateToCached(fromCity, toCity, transportPreference);
  }

  if (provider === 'juhe') {
    const juhe =
      transportPreference === 'flight'
        ? null
        : await queryJuheTrainSchedule(fromCity, toCity, travelDate, transportPreference);
    if (juhe) return juhe;
    const catalog = findCatalogSchedule(fromCity, toCity, transportPreference);
    if (catalog) return catalogToCached(catalog, travelDate);
    return templateToCached(fromCity, toCity, transportPreference);
  }

  if (provider === 'catalog') {
    const catalog = findCatalogSchedule(fromCity, toCity, transportPreference);
    if (catalog) return catalogToCached(catalog, travelDate);
    return templateToCached(fromCity, toCity, transportPreference);
  }

  // auto
  if (transportPreference !== 'flight') {
    const juhe = await queryJuheTrainSchedule(
      fromCity,
      toCity,
      travelDate,
      transportPreference,
    );
    if (juhe) return juhe;
  }

  const catalog = findCatalogSchedule(fromCity, toCity, transportPreference);
  if (catalog) return catalogToCached(catalog, travelDate);

  return templateToCached(fromCity, toCity, transportPreference);
}

export async function queryIntercitySchedule(
  query: IntercityScheduleQuery,
): Promise<CachedIntercitySchedule | null> {
  if (!isIntercityTransitEnabled()) {
    return templateToCached(query.fromCity, query.toCity, query.transportPreference);
  }

  const travelDate = query.travelDate?.trim()
    ? resolveTravelDateIso(0, query.travelDate, null)
    : resolveTravelDateIso(0, null, null);

  const provider = getIntercityProvider();
  const preferenceKey = query.transportPreference ?? 'any';
  const cacheKey = buildIntercityCacheKey(
    query.fromCity,
    query.toCity,
    travelDate,
    preferenceKey,
    provider,
  );

  const cached = await getCachedIntercitySchedule(cacheKey);
  if (cached) return cached;

  const result = await queryFromProvider(provider, { ...query, travelDate }, travelDate);
  if (result) {
    await setCachedIntercitySchedule(cacheKey, result);
  }
  return result;
}

export function cachedScheduleToTransitSegment(
  offer: CachedIntercitySchedule,
  preference: TransportPreference | null | undefined,
  locale: LocaleCode,
): RouteTransitSegment {
  const descriptionKey =
    offer.source === 'api' ? 'api' : offer.source === 'catalog' ? 'catalog' : 'template';

  const scheduleNoForText =
    offer.scheduleNo && offer.scheduleNo !== '—' ? offer.scheduleNo : undefined;

  return {
    kind: 'intercity',
    mode: pickIntercityMode(preference, offer.mode),
    from: offer.fromLabel,
    to: offer.toLabel,
    time: formatTimeRange(offer.departureTime, offer.arrivalTime),
    durationMinutes: offer.durationMinutes,
    cost: offer.cost,
    bookingUrl: offer.bookingUrl,
    estimated: offer.estimated,
    scheduleNo: scheduleNoForText,
    scheduleSource: offer.source,
    description: formatIntercitySegmentDescription(descriptionKey, locale, {
      scheduleNo: scheduleNoForText ?? offer.scheduleNo,
    }),
  };
}

export async function resolveIntercityTransitSegment(
  fromCity: string,
  toCity: string,
  options: {
    dayIndex: number;
    dayDate?: string | null;
    startDate?: string | null;
    transportPreference?: TransportPreference | null;
    locale: LocaleCode;
  },
): Promise<RouteTransitSegment | null> {
  const travelDate = resolveTravelDateIso(
    options.dayIndex,
    options.dayDate,
    options.startDate,
  );

  const offer = await queryIntercitySchedule({
    fromCity,
    toCity,
    travelDate,
    transportPreference: options.transportPreference,
    locale: options.locale,
  });

  if (!offer) return null;

  return cachedScheduleToTransitSegment(
    offer,
    options.transportPreference,
    options.locale,
  );
}
