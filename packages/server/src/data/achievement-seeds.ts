import {
  AchievementCategory,
  AchievementConditionType,
  AchievementType,
} from '@douxing/shared';

export interface AchievementSeed {
  achievementCode: string;
  name: string;
  description: string;
  category: string;
  conditionType: string;
  conditionValue: Record<string, unknown>;
  iconUrl: string;
  pointsReward: number;
  sortOrder: number;
}

/** 成就配置种子（8 种） */
export const ACHIEVEMENT_SEEDS: AchievementSeed[] = [
  {
    achievementCode: AchievementType.FIRST_CHECKIN,
    name: '初行者',
    description: '完成首次旅行打卡',
    category: AchievementCategory.EXPLORE,
    conditionType: AchievementConditionType.TOTAL_CHECKINS,
    conditionValue: { minCount: 1 },
    iconUrl: '👣',
    pointsReward: 10,
    sortOrder: 1,
  },
  {
    achievementCode: AchievementType.EXPLORER,
    name: '探索达人',
    description: '累计打卡达到 3 次',
    category: AchievementCategory.EXPLORE,
    conditionType: AchievementConditionType.TOTAL_CHECKINS,
    conditionValue: { minCount: 3 },
    iconUrl: '🧭',
    pointsReward: 30,
    sortOrder: 2,
  },
  {
    achievementCode: AchievementType.VETERAN_TRAVELER,
    name: '打卡达人',
    description: '累计打卡达到 10 次',
    category: AchievementCategory.EXPLORE,
    conditionType: AchievementConditionType.TOTAL_CHECKINS,
    conditionValue: { minCount: 10 },
    iconUrl: '🎒',
    pointsReward: 100,
    sortOrder: 3,
  },
  {
    achievementCode: AchievementType.CITY_WANDERER,
    name: '跨城旅人',
    description: '在 2 个不同城市打卡',
    category: AchievementCategory.EXPLORE,
    conditionType: AchievementConditionType.DISTINCT_CITIES,
    conditionValue: { minCount: 2 },
    iconUrl: '🗺️',
    pointsReward: 50,
    sortOrder: 4,
  },
  {
    achievementCode: AchievementType.CITY_CONQUEROR,
    name: '城市征服者',
    description: '在 4 个不同城市打卡',
    category: AchievementCategory.EXPLORE,
    conditionType: AchievementConditionType.DISTINCT_CITIES,
    conditionValue: { minCount: 4 },
    iconUrl: '🏆',
    pointsReward: 200,
    sortOrder: 5,
  },
  {
    achievementCode: AchievementType.ROUTE_MASTER,
    name: '路线大师',
    description: '在同一路线打卡 2 个景点',
    category: AchievementCategory.CHALLENGE,
    conditionType: AchievementConditionType.ROUTE_CHECKINS,
    conditionValue: { minCount: 2 },
    iconUrl: '🛤️',
    pointsReward: 40,
    sortOrder: 6,
  },
  {
    achievementCode: AchievementType.PHOTO_STORY,
    name: '旅拍记录',
    description: '完成一次带照片的打卡',
    category: AchievementCategory.CHALLENGE,
    conditionType: AchievementConditionType.PHOTO_CHECKIN,
    conditionValue: {},
    iconUrl: '📸',
    pointsReward: 15,
    sortOrder: 7,
  },
  {
    achievementCode: AchievementType.STREAK_WEEK,
    name: '七日连续',
    description: '连续 7 天打卡',
    category: AchievementCategory.CHALLENGE,
    conditionType: AchievementConditionType.CONSECUTIVE_DAYS,
    conditionValue: { minCount: 7 },
    iconUrl: '🔥',
    pointsReward: 80,
    sortOrder: 8,
  },
];
