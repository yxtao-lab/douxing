import type { RouteTransitMode } from '@douxing/shared';

/** Phase 1：跨城大交通参考模板（非真实班次） */
export interface CityPairTransitTemplate {
  from: string;
  to: string;
  mode: Extract<RouteTransitMode, 'train' | 'flight'>;
  durationMinutes: number;
  cost: number;
  /** 参考出发时刻 HH:mm */
  departureTime: string;
  /** mock 订票链接 */
  bookingUrl: string;
}

export const CITY_PAIR_TRANSIT_TEMPLATES: CityPairTransitTemplate[] = [
  {
    from: '杭州',
    to: '上海',
    mode: 'train',
    durationMinutes: 60,
    cost: 73,
    departureTime: '08:30',
    bookingUrl: 'https://example.com/demo/train/hangzhou-shanghai',
  },
  {
    from: '上海',
    to: '杭州',
    mode: 'train',
    durationMinutes: 60,
    cost: 73,
    departureTime: '09:00',
    bookingUrl: 'https://example.com/demo/train/shanghai-hangzhou',
  },
  {
    from: '北京',
    to: '上海',
    mode: 'train',
    durationMinutes: 270,
    cost: 553,
    departureTime: '07:00',
    bookingUrl: 'https://example.com/demo/train/beijing-shanghai',
  },
  {
    from: '上海',
    to: '北京',
    mode: 'train',
    durationMinutes: 270,
    cost: 553,
    departureTime: '08:00',
    bookingUrl: 'https://example.com/demo/train/shanghai-beijing',
  },
  {
    from: '北京',
    to: '西安',
    mode: 'train',
    durationMinutes: 300,
    cost: 515,
    departureTime: '08:30',
    bookingUrl: 'https://example.com/demo/train/beijing-xian',
  },
  {
    from: '西安',
    to: '北京',
    mode: 'train',
    durationMinutes: 300,
    cost: 515,
    departureTime: '09:00',
    bookingUrl: 'https://example.com/demo/train/xian-beijing',
  },
  {
    from: '广州',
    to: '深圳',
    mode: 'train',
    durationMinutes: 35,
    cost: 75,
    departureTime: '09:30',
    bookingUrl: 'https://example.com/demo/train/guangzhou-shenzhen',
  },
  {
    from: '深圳',
    to: '广州',
    mode: 'train',
    durationMinutes: 35,
    cost: 75,
    departureTime: '10:00',
    bookingUrl: 'https://example.com/demo/train/shenzhen-guangzhou',
  },
  {
    from: '成都',
    to: '重庆',
    mode: 'train',
    durationMinutes: 90,
    cost: 154,
    departureTime: '08:00',
    bookingUrl: 'https://example.com/demo/train/chengdu-chongqing',
  },
  {
    from: '重庆',
    to: '成都',
    mode: 'train',
    durationMinutes: 90,
    cost: 154,
    departureTime: '09:00',
    bookingUrl: 'https://example.com/demo/train/chongqing-chengdu',
  },
  {
    from: '北京',
    to: '广州',
    mode: 'flight',
    durationMinutes: 195,
    cost: 980,
    departureTime: '07:30',
    bookingUrl: 'https://example.com/demo/flight/beijing-guangzhou',
  },
  {
    from: '广州',
    to: '北京',
    mode: 'flight',
    durationMinutes: 195,
    cost: 980,
    departureTime: '14:00',
    bookingUrl: 'https://example.com/demo/flight/guangzhou-beijing',
  },
];

export function findCityPairTemplate(
  from: string,
  to: string,
  preferMode?: 'train' | 'flight' | 'high_speed_rail' | 'self_drive' | 'any',
): CityPairTransitTemplate | null {
  const normalizedFrom = from.trim();
  const normalizedTo = to.trim();
  const matches = CITY_PAIR_TRANSIT_TEMPLATES.filter(
    (t) => t.from === normalizedFrom && t.to === normalizedTo,
  );
  if (matches.length === 0) return null;
  if (preferMode === 'flight') {
    return matches.find((m) => m.mode === 'flight') ?? matches[0]!;
  }
  if (preferMode === 'train' || preferMode === 'high_speed_rail') {
    return matches.find((m) => m.mode === 'train') ?? matches[0]!;
  }
  return matches[0]!;
}
