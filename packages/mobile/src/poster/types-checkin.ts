import type { LocaleCode } from '@douxing/shared';
import type { PosterThemePresetId } from './types';

/** 打卡海报的单个打卡点（简化足迹地图用） */
export interface CheckinMapPosterLocation {
  name: string;
  city: string | null;
  latitude: number;
  longitude: number;
  points: number;
  photoUrl?: string;
}

/** 打卡海报标签文案 */
export interface CheckinPosterLabels {
  checkins: string;
  cities: string;
  points: string;
  mapTitle: string;
  noMapData: string;
  footprintDirection: string;
  footprintByTime: string;
}

/** 打卡足迹海报数据层 */
export interface CheckinMapPosterPayload {
  userId: number;
  nickname: string;
  avatarUrl: string | null;
  checkinCount: number;
  totalPoints: number;
  cityCount: number;
  checkinLocations: CheckinMapPosterLocation[];
  brand: {
    name: string;
    tagline: string;
    scanHint: string;
  };
  qrUrl: string | null;
  locale: LocaleCode;
  labels: CheckinPosterLabels;
  themePresetId: PosterThemePresetId;
}
