import type { TransportPreference } from '@douxing/shared';
import { getIntercityRequestTimeoutMs, getJuheApiKey } from '../config/intercity.js';
import { buildCtripTrainBookingUrl } from '../data/intercity-schedule-catalog.js';
import { resolveTrainStation } from '../data/intercity-stations.js';
import type { CachedIntercitySchedule } from './intercity-transit-cache.service.js';

/**
 * 聚合数据「火车订票查询」站到站时刻表
 * @see https://www.juhe.cn/docs/api/id/817
 */
const JUHE_TRAIN_QUERY_URL = 'https://apis.juhe.cn/fapigw/train/query';

interface JuheTrainPrice {
  seat_name?: string;
  price?: number;
  num?: string;
}

interface JuheTrainItem {
  train_no?: string;
  departure_station?: string;
  arrival_station?: string;
  departure_time?: string;
  arrival_time?: string;
  duration?: string;
  enable_booking?: string;
  prices?: JuheTrainPrice[];
}

interface JuheTrainQueryResponse {
  error_code?: number;
  reason?: string;
  result?: JuheTrainItem[];
}

function parseDurationMinutes(duration: string | undefined): number | null {
  if (!duration?.trim()) return null;
  const colon = duration.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (colon) {
    const hours = parseInt(colon[1]!, 10);
    const minutes = parseInt(colon[2]!, 10);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return hours * 60 + minutes;
    }
  }
  const cn = duration.trim().match(/(?:(\d+)小时)?(?:(\d+)分)?/);
  if (!cn) return null;
  const hours = parseInt(cn[1] ?? '0', 10);
  const minutes = parseInt(cn[2] ?? '0', 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function pickMinPrice(prices: JuheTrainPrice[] | undefined): number | null {
  if (!prices?.length) return null;
  let min: number | null = null;
  for (const item of prices) {
    if (typeof item.price !== 'number' || item.price <= 0) continue;
    min = min == null ? item.price : Math.min(min, item.price);
  }
  return min != null ? Math.round(min) : null;
}

function buildJuheFilter(preference?: TransportPreference | null): string {
  if (preference === 'high_speed_rail') return 'G,D';
  if (preference === 'train') return '';
  return 'G,D';
}

function preferJuheTrain(
  list: JuheTrainItem[] | undefined,
  preference?: TransportPreference | null,
): JuheTrainItem | null {
  if (!list?.length) return null;

  const bookable = list.filter((item) => item.enable_booking !== 'N');
  const pool = bookable.length > 0 ? bookable : list;

  const highSpeed = pool.filter(
    (item) =>
      item.train_no?.startsWith('G') ||
      item.train_no?.startsWith('D') ||
      item.train_no?.startsWith('C'),
  );

  if (preference === 'high_speed_rail' || preference === 'train') {
    return highSpeed[0] ?? pool[0] ?? null;
  }
  return highSpeed[0] ?? pool[0] ?? null;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function computeDurationFromTimes(departure: string, arrival: string): number {
  const depParts = departure.split(':').map((v) => parseInt(v, 10));
  const arrParts = arrival.split(':').map((v) => parseInt(v, 10));
  const depMin = (depParts[0] ?? 0) * 60 + (depParts[1] ?? 0);
  let arrMin = (arrParts[0] ?? 0) * 60 + (arrParts[1] ?? 0);
  if (arrMin < depMin) arrMin += 24 * 60;
  return Math.max(15, arrMin - depMin);
}

export async function queryJuheTrainSchedule(
  fromCity: string,
  toCity: string,
  travelDate: string,
  preference?: TransportPreference | null,
): Promise<CachedIntercitySchedule | null> {
  const apiKey = getJuheApiKey();
  if (!apiKey) return null;

  const fromStation = resolveTrainStation(fromCity);
  const toStation = resolveTrainStation(toCity);
  const filter = buildJuheFilter(preference);

  const params = new URLSearchParams({
    key: apiKey,
    search_type: '1',
    departure_station: fromStation,
    arrival_station: toStation,
    date: travelDate,
    enable_booking: '1',
  });
  if (filter) {
    params.set('filter', filter);
  }

  try {
    const timeoutMs = getIntercityRequestTimeoutMs();
    const res = await fetchWithTimeout(`${JUHE_TRAIN_QUERY_URL}?${params}`, timeoutMs);
    const data = (await res.json()) as JuheTrainQueryResponse;

    if (data.error_code !== 0 || !data.result?.length) {
      console.warn('[intercity-juhe] 无班次:', data.reason ?? data.error_code);
      return null;
    }

    const picked = preferJuheTrain(data.result, preference);
    if (!picked?.train_no || !picked.departure_time || !picked.arrival_time) {
      return null;
    }

    const durationMinutes =
      parseDurationMinutes(picked.duration) ??
      computeDurationFromTimes(picked.departure_time, picked.arrival_time);

    const fromLabel = picked.departure_station?.trim() || fromStation;
    const toLabel = picked.arrival_station?.trim() || toStation;
    const cost = pickMinPrice(picked.prices);

    return {
      mode: 'train',
      scheduleNo: picked.train_no.trim(),
      fromLabel,
      toLabel,
      departureTime: picked.departure_time.trim(),
      arrivalTime: picked.arrival_time.trim(),
      durationMinutes: durationMinutes ?? 120,
      cost: cost ?? 0,
      bookingUrl: buildCtripTrainBookingUrl(fromLabel, toLabel, travelDate),
      source: 'api',
      estimated: false,
    };
  } catch (err) {
    console.warn(
      '[intercity-juhe] 查询失败:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
