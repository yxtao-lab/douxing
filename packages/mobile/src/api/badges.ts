import type { BadgeCatalogItem, UserBadgeInfo } from '@douxing/shared';
import { request } from '@/utils/request';

export function fetchBadgeCatalog() {
  return request<BadgeCatalogItem[]>('/badges');
}

export function fetchMyBadges() {
  return request<UserBadgeInfo[]>('/badges/mine');
}
