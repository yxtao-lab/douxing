import type { RouteTransitMode, TransportPreference } from '@douxing/shared';

/** H9-3：班次库条目（公开参考时刻，非实时余票） */
export interface IntercityScheduleCatalogEntry {
  fromCity: string;
  toCity: string;
  mode: Extract<RouteTransitMode, 'train' | 'flight'>;
  scheduleNo: string;
  fromStation: string;
  toStation: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  cost: number;
}

/**
 * 热门城市对参考班次（高铁 G/D 与典型航班）。
 * 时刻为公开运行图参考值；实际以第三方订票页为准。
 */
export const INTERCITY_SCHEDULE_CATALOG: IntercityScheduleCatalogEntry[] = [
  {
    fromCity: '杭州',
    toCity: '上海',
    mode: 'train',
    scheduleNo: 'G7313',
    fromStation: '杭州东',
    toStation: '上海虹桥',
    departureTime: '08:30',
    arrivalTime: '09:28',
    durationMinutes: 58,
    cost: 73,
  },
  {
    fromCity: '上海',
    toCity: '杭州',
    mode: 'train',
    scheduleNo: 'G7318',
    fromStation: '上海虹桥',
    toStation: '杭州东',
    departureTime: '09:00',
    arrivalTime: '09:58',
    durationMinutes: 58,
    cost: 73,
  },
  {
    fromCity: '北京',
    toCity: '上海',
    mode: 'train',
    scheduleNo: 'G1',
    fromStation: '北京南',
    toStation: '上海虹桥',
    departureTime: '07:00',
    arrivalTime: '11:28',
    durationMinutes: 268,
    cost: 553,
  },
  {
    fromCity: '上海',
    toCity: '北京',
    mode: 'train',
    scheduleNo: 'G2',
    fromStation: '上海虹桥',
    toStation: '北京南',
    departureTime: '08:00',
    arrivalTime: '12:28',
    durationMinutes: 268,
    cost: 553,
  },
  {
    fromCity: '北京',
    toCity: '西安',
    mode: 'train',
    scheduleNo: 'G87',
    fromStation: '北京西',
    toStation: '西安北',
    departureTime: '08:30',
    arrivalTime: '13:30',
    durationMinutes: 300,
    cost: 515,
  },
  {
    fromCity: '西安',
    toCity: '北京',
    mode: 'train',
    scheduleNo: 'G88',
    fromStation: '西安北',
    toStation: '北京西',
    departureTime: '09:00',
    arrivalTime: '14:00',
    durationMinutes: 300,
    cost: 515,
  },
  {
    fromCity: '广州',
    toCity: '深圳',
    mode: 'train',
    scheduleNo: 'G6201',
    fromStation: '广州南',
    toStation: '深圳北',
    departureTime: '09:30',
    arrivalTime: '10:05',
    durationMinutes: 35,
    cost: 75,
  },
  {
    fromCity: '深圳',
    toCity: '广州',
    mode: 'train',
    scheduleNo: 'G6202',
    fromStation: '深圳北',
    toStation: '广州南',
    departureTime: '10:00',
    arrivalTime: '10:35',
    durationMinutes: 35,
    cost: 75,
  },
  {
    fromCity: '成都',
    toCity: '重庆',
    mode: 'train',
    scheduleNo: 'G8501',
    fromStation: '成都东',
    toStation: '重庆北',
    departureTime: '08:00',
    arrivalTime: '09:30',
    durationMinutes: 90,
    cost: 154,
  },
  {
    fromCity: '重庆',
    toCity: '成都',
    mode: 'train',
    scheduleNo: 'G8502',
    fromStation: '重庆北',
    toStation: '成都东',
    departureTime: '09:00',
    arrivalTime: '10:30',
    durationMinutes: 90,
    cost: 154,
  },
  {
    fromCity: '北京',
    toCity: '广州',
    mode: 'flight',
    scheduleNo: 'CA1301',
    fromStation: '北京首都T3',
    toStation: '广州白云T2',
    departureTime: '07:30',
    arrivalTime: '10:45',
    durationMinutes: 195,
    cost: 980,
  },
  {
    fromCity: '广州',
    toCity: '北京',
    mode: 'flight',
    scheduleNo: 'CA1302',
    fromStation: '广州白云T2',
    toStation: '北京首都T3',
    departureTime: '14:00',
    arrivalTime: '17:15',
    durationMinutes: 195,
    cost: 980,
  },
];

function matchesModePreference(
  mode: 'train' | 'flight',
  preference?: TransportPreference | null,
): boolean {
  if (!preference || preference === 'any') return true;
  if (preference === 'flight') return mode === 'flight';
  if (
    preference === 'train' ||
    preference === 'high_speed_rail' ||
    preference === 'self_drive'
  ) {
    return mode === 'train';
  }
  return true;
}

export function findCatalogSchedule(
  fromCity: string,
  toCity: string,
  preference?: TransportPreference | null,
): IntercityScheduleCatalogEntry | null {
  const from = fromCity.trim();
  const to = toCity.trim();
  const matches = INTERCITY_SCHEDULE_CATALOG.filter(
    (entry) => entry.fromCity === from && entry.toCity === to,
  );
  if (matches.length === 0) return null;

  const preferred = matches.filter((entry) => matchesModePreference(entry.mode, preference));
  const pool = preferred.length > 0 ? preferred : matches;

  if (preference === 'flight') {
    return pool.find((entry) => entry.mode === 'flight') ?? pool[0]!;
  }
  if (preference === 'train' || preference === 'high_speed_rail') {
    return pool.find((entry) => entry.mode === 'train') ?? pool[0]!;
  }
  return pool[0]!;
}

/** 携程火车票列表页（第三方订票跳转，非兜行自营） */
export function buildCtripTrainBookingUrl(
  fromStation: string,
  toStation: string,
  travelDate: string,
): string {
  const params = new URLSearchParams({
    ticketType: '0',
    dStation: fromStation,
    aStation: toStation,
    dDate: travelDate,
    rDate: '',
    highSpeedOnly: '0',
  });
  return `https://trains.ctrip.com/webapp/train/list?${params.toString()}`;
}

/** 携程机票单程列表页 */
export function buildCtripFlightBookingUrl(
  fromCity: string,
  toCity: string,
  travelDate: string,
): string {
  const from = encodeURIComponent(fromCity.trim());
  const to = encodeURIComponent(toCity.trim());
  return `https://flights.ctrip.com/online/list/oneway-${from}-${to}?depdate=${travelDate}&cabin=y_s&adult=1&child=0&infant=0`;
}

export function buildCatalogBookingUrl(
  entry: IntercityScheduleCatalogEntry,
  travelDate: string,
): string {
  if (entry.mode === 'flight') {
    return buildCtripFlightBookingUrl(entry.fromCity, entry.toCity, travelDate);
  }
  return buildCtripTrainBookingUrl(entry.fromStation, entry.toStation, travelDate);
}
