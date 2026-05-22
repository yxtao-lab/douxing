import {
  BadgeCategory,
  BadgeConditionType,
  BadgeRarity,
} from '@douxing/shared';

export interface BadgeSeed {
  badgeCode: string;
  name: string;
  description: string;
  category: string;
  conditionType: string;
  conditionValue: Record<string, unknown>;
  iconUrl: string;
  rarity: string;
  pointsReward: number;
}

/** 徽章种子数据 */
export const BADGE_SEEDS: BadgeSeed[] = [
  // 城市徽章
  {
    badgeCode: 'city_hangzhou',
    name: '西湖行者',
    description: '在杭州完成首次打卡',
    category: BadgeCategory.CITY,
    conditionType: BadgeConditionType.CITY_CHECKIN,
    conditionValue: { cityCode: 'hangzhou', cityName: '杭州' },
    iconUrl: '🏞️',
    rarity: BadgeRarity.COMMON,
    pointsReward: 20,
  },
  {
    badgeCode: 'city_shanghai',
    name: '魔都足迹',
    description: '在上海完成首次打卡',
    category: BadgeCategory.CITY,
    conditionType: BadgeConditionType.CITY_CHECKIN,
    conditionValue: { cityCode: 'shanghai', cityName: '上海' },
    iconUrl: '🌃',
    rarity: BadgeRarity.COMMON,
    pointsReward: 20,
  },
  {
    badgeCode: 'city_beijing',
    name: '京城印记',
    description: '在北京完成首次打卡',
    category: BadgeCategory.CITY,
    conditionType: BadgeConditionType.CITY_CHECKIN,
    conditionValue: { cityCode: 'beijing', cityName: '北京' },
    iconUrl: '🏯',
    rarity: BadgeRarity.COMMON,
    pointsReward: 20,
  },
  {
    badgeCode: 'city_chengdu',
    name: '蓉城初探',
    description: '在成都完成首次打卡',
    category: BadgeCategory.CITY,
    conditionType: BadgeConditionType.CITY_CHECKIN,
    conditionValue: { cityCode: 'chengdu', cityName: '成都' },
    iconUrl: '🐼',
    rarity: BadgeRarity.COMMON,
    pointsReward: 20,
  },
  // 成就徽章
  {
    badgeCode: 'first_step',
    name: '踏出第一步',
    description: '完成首次旅行打卡',
    category: BadgeCategory.ACHIEVEMENT,
    conditionType: BadgeConditionType.TOTAL_CHECKINS,
    conditionValue: { minCount: 1 },
    iconUrl: '👣',
    rarity: BadgeRarity.COMMON,
    pointsReward: 10,
  },
  {
    badgeCode: 'explorer_3',
    name: '探索者',
    description: '累计打卡 3 次',
    category: BadgeCategory.ACHIEVEMENT,
    conditionType: BadgeConditionType.TOTAL_CHECKINS,
    conditionValue: { minCount: 3 },
    iconUrl: '🧭',
    rarity: BadgeRarity.RARE,
    pointsReward: 30,
  },
  {
    badgeCode: 'explorer_10',
    name: '资深旅人',
    description: '累计打卡 10 次',
    category: BadgeCategory.ACHIEVEMENT,
    conditionType: BadgeConditionType.TOTAL_CHECKINS,
    conditionValue: { minCount: 10 },
    iconUrl: '🎒',
    rarity: BadgeRarity.EPIC,
    pointsReward: 100,
  },
  {
    badgeCode: 'wanderer_2',
    name: '双城记',
    description: '在 2 个不同城市打卡',
    category: BadgeCategory.ACHIEVEMENT,
    conditionType: BadgeConditionType.DISTINCT_CITIES,
    conditionValue: { minCount: 2 },
    iconUrl: '🗺️',
    rarity: BadgeRarity.RARE,
    pointsReward: 50,
  },
  {
    badgeCode: 'wanderer_4',
    name: '城市征服者',
    description: '在 4 个不同城市打卡',
    category: BadgeCategory.ACHIEVEMENT,
    conditionType: BadgeConditionType.DISTINCT_CITIES,
    conditionValue: { minCount: 4 },
    iconUrl: '🏆',
    rarity: BadgeRarity.LEGENDARY,
    pointsReward: 200,
  },
  {
    badgeCode: 'photographer',
    name: '定格瞬间',
    description: '完成一次带照片的打卡',
    category: BadgeCategory.SPECIAL,
    conditionType: BadgeConditionType.PHOTO_CHECKIN,
    conditionValue: {},
    iconUrl: '📸',
    rarity: BadgeRarity.RARE,
    pointsReward: 15,
  },
  {
    badgeCode: 'route_master',
    name: '路线达人',
    description: '在同一路线打卡 2 个景点',
    category: BadgeCategory.SPECIAL,
    conditionType: BadgeConditionType.ROUTE_CHECKINS,
    conditionValue: { minCount: 2 },
    iconUrl: '🛤️',
    rarity: BadgeRarity.EPIC,
    pointsReward: 40,
  },
];
