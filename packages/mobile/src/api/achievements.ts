import type { AchievementInfo } from '@douxing/shared';
import { request } from '@/utils/request';

export function fetchAchievements() {
  return request<AchievementInfo[]>('/achievements');
}
