import type { CheckInInfo, UserInfo, LocaleCode } from '@douxing/shared';
import type { CheckinMapPosterPayload, CheckinMapPosterLocation, CheckinPosterLabels } from './types-checkin';

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

export interface BuildCheckinPosterPayloadInput {
  checkins: CheckInInfo[];
  user: Pick<UserInfo, 'id' | 'nickname' | 'avatar'>;
  locale: LocaleCode;
  brandName: string;
  brandTagline: string;
  scanHint: string;
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

  const locations: CheckinMapPosterLocation[] = sorted.map((item) => ({
    name: item.location.placeName || '',
    city: item.city || item.cityCode || null,
    latitude: item.location.latitude ?? 0,
    longitude: item.location.longitude ?? 0,
    points: item.pointsEarned,
    photoUrl: item.photos[0],
  }));

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
    };
  }
  return {
    checkins: '打卡',
    cities: '城市',
    points: '积分',
    mapTitle: '足迹地图',
    noMapData: '暂无打卡数据',
  };
}
