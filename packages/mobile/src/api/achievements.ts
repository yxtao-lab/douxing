import type { AchievementCatalogItem, AchievementInfo } from '@douxing/shared';
import { request } from '@/utils/request';

export function fetchAchievementCatalog() {
  return request<AchievementCatalogItem[]>('/achievements/catalog');
}

export function fetchMyAchievements() {
  return request<AchievementInfo[]>('/achievements/mine');
}

/** 兼容旧接口 */
export function fetchAchievements() {
  return request<AchievementInfo[]>('/achievements');
}
