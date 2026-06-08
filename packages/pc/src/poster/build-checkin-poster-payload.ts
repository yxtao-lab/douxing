import type { CheckInInfo, UserInfo, LocaleCode } from '@douxing/shared';
import type { CheckinMapPosterPayload, CheckinMapPosterLocation, CheckinPosterLabels } from './types-checkin';
import type { PosterThemePresetId } from './types';
import { loadStoredPosterRenderOptions } from './poster-options';

/** 生成打卡分享页链接 */
export function buildCheckinShareUrl(): string | null {
  const base = import.meta.env.VITE_H5_BASE_URL?.trim().replace(/\/$/, '');
  if (!base) return null;
  return `${base}/#/pages/checkins/map`;
}

/** 计算去重城市数量 */
function uniqueCityCount(items: CheckInInfo[]): number {
  const cities = new Set<string>();
  for (const item of items) {
    const city = item.city || item.cityCode;
    if (city) cities.add(city);
  }
  return cities.size;
}

function cityKeyForCheckIn(item: CheckInInfo): string {
  return (item.city || item.cityCode || item.location.placeName || `checkin-${item.id}`).trim();
}

function hasValidCoords(lat: number, lng: number): boolean {
  return lat !== 0 || lng !== 0;
}

/** 海报地图按城市聚合（与「N 城市」统计一致，避免同城多次打卡叠在同一点） */
function aggregateMapLocationsByCity(sorted: CheckInInfo[]): CheckinMapPosterLocation[] {
  const order: string[] = [];
  const groups = new Map<
    string,
    {
      city: string | null;
      name: string;
      lats: number[];
      lngs: number[];
      photoUrl?: string;
      visitCount: number;
    }
  >();

  for (const item of sorted) {
    const key = cityKeyForCheckIn(item);
    if (!groups.has(key)) {
      order.push(key);
      groups.set(key, {
        city: item.city || item.cityCode || null,
        name: item.location.placeName || '',
        lats: [],
        lngs: [],
        visitCount: 0,
      });
    }
    const group = groups.get(key)!;
    group.visitCount += 1;

    const lat = item.location.latitude ?? 0;
    const lng = item.location.longitude ?? 0;
    if (hasValidCoords(lat, lng)) {
      group.lats.push(lat);
      group.lngs.push(lng);
    }
    if (item.photos[0]) {
      group.photoUrl = item.photos[0];
    }
    if (!group.name && item.location.placeName) {
      group.name = item.location.placeName;
    }
  }

  return order.map((key) => {
    const group = groups.get(key)!;
    const latitude = group.lats.length
      ? group.lats.reduce((sum, v) => sum + v, 0) / group.lats.length
      : 0;
    const longitude = group.lngs.length
      ? group.lngs.reduce((sum, v) => sum + v, 0) / group.lngs.length
      : 0;
    return {
      name: group.name,
      city: group.city,
      latitude,
      longitude,
      points: group.visitCount,
      photoUrl: group.photoUrl,
    };
  });
}

export interface BuildCheckinPosterPayloadInput {
  checkins: CheckInInfo[];
  user: Pick<UserInfo, 'id' | 'nickname' | 'avatar'>;
  locale: LocaleCode;
  brandName: string;
  brandTagline: string;
  scanHint: string;
  themePresetId?: PosterThemePresetId;
}


/** 从打卡列表构建打卡海报数据 */
export function buildCheckinPosterPayload(
  input: BuildCheckinPosterPayloadInput,
): CheckinMapPosterPayload | null {
  const { checkins, user, locale, brandName, brandTagline, scanHint } = input;
  if (checkins.length === 0) return null;

  const sorted = [...checkins].sort(
    (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime(),
  );

  const locations = aggregateMapLocationsByCity(sorted);

  const totalPoints = sorted.reduce((sum, item) => sum + item.pointsEarned, 0);
  const cityCount = uniqueCityCount(sorted);

  // 构造标签
  const labels = buildCheckinLabels(locale);

  return {
    userId: user.id,
    nickname: user.nickname || '—',
    avatarUrl: user.avatar || null,
    checkinCount: sorted.length,
    totalPoints,
    cityCount,
    checkinLocations: locations,
    brand: {
      name: brandName,
      tagline: brandTagline,
      scanHint,
    },
    qrUrl: buildCheckinShareUrl(),
    locale,
    labels,
    themePresetId: input.themePresetId ?? loadStoredPosterRenderOptions().themePresetId,
  };
}

function buildCheckinLabels(locale: LocaleCode): CheckinPosterLabels {
  if (locale === 'en-US') {
    return {
      checkins: 'Check-ins',
      cities: 'Cities',
      points: 'Points',
      mapTitle: 'Footprint Map',
      noMapData: 'No check-in data',
      footprintDirection: 'Footprint direction',
      footprintByTime: 'By check-in order',
    };
  }
  return {
    checkins: '打卡',
    cities: '城市',
    points: '积分',
    mapTitle: '足迹地图',
    noMapData: '暂无打卡数据',
    footprintDirection: '足迹方向',
    footprintByTime: '按打卡顺序',
  };
}
