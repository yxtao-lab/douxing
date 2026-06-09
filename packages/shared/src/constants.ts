export const APP_NAME = '兜行';

export const API_PREFIX = '/api';

export const UserStatus = {
  ACTIVE: 1,
  DISABLED: 0,
} as const;

export const RoleCode = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

/** 用户业务类型（users.user_type） */
export const UserType = {
  NORMAL: 1,
  CREATOR: 2,
} as const;

/** 会员等级（users.member_level） */
export const MemberLevel = {
  FREE: 0,
  SILVER: 1,
  GOLD: 2,
  VIP: 3,
} as const;

/** 路线状态（travel_routes.status） */
export const RouteStatus = {
  DRAFT: 0,
  PUBLISHED: 1,
  ARCHIVED: 2,
} as const;

/** 规划会话状态（plan_sessions.status） */
export const PlanSessionStatus = {
  ACTIVE: 0,
  CLOSED: 1,
} as const;

/** 打卡状态（check_ins.status） */
export const CheckInStatus = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
} as const;

/** 订单状态（orders.status） */
export const OrderStatus = {
  PENDING: 0,
  PAID: 1,
  COMPLETED: 2,
  CANCELLED: 3,
} as const;

/** 订单类型 */
export const OrderType = {
  ROUTE: 'route',
} as const;

/** 支付渠道 */
export const PaymentChannel = {
  MOCK: 'mock',
  WECHAT_JSAPI: 'wechat_jsapi',
} as const;

/** LLM 模型提供商（路线生成） */
export const LlmProvider = {
  AUTO: 'auto',
  DEEPSEEK: 'deepseek',
  LMSTUDIO: 'lmstudio',
} as const;

/** 用户资料：可选兴趣标签（预设） */
export const USER_INTEREST_PRESETS = [
  '文化',
  '自然',
  '美食',
  '亲子',
  '娱乐',
  '都市',
  '购物',
  '夜景',
  '历史',
  '休闲',
  '户外',
  '摄影',
] as const;

/** 用户资料：兴趣标签数量上限 */
export const USER_INTEREST_MAX = 8;

/** 景点状态（attractions.status） */
export const AttractionStatus = {
  DISABLED: 0,
  ACTIVE: 1,
  /** AI 同步新建，待运营审核 */
  PENDING: 2,
} as const;

/** 景点数据来源（attractions.source） */
export const AttractionSource = {
  SEED: 'seed',
  LLM: 'llm',
  MANUAL: 'manual',
  AMAP: 'amap',
} as const;

/** 景点封面图来源（attractions.image_source） */
export const AttractionImageSource = {
  MANUAL: 'manual',
  AMAP: 'amap',
  WIKIMEDIA: 'wikimedia',
  UGC: 'ugc',
  GENERATED: 'generated',
} as const;

/** 门票/参考价来源（attractions.price_source） */
export const AttractionPriceSource = {
  SEED: 'seed',
  LLM_ESTIMATE: 'llm_estimate',
  MANUAL: 'manual',
  EXTERNAL: 'external',
} as const;

/** 路线节点 POI 类型（不入库的用 meal/transport/other） */
export const PoiCategory = {
  ATTRACTION: 'attraction',
  RESTAURANT: 'restaurant',
  HOTEL: 'hotel',
  MEAL: 'meal',
  TRANSPORT: 'transport',
  OTHER: 'other',
} as const;

/** attractions 表 category 字段（可入库类型） */
export const AttractionCategory = {
  ATTRACTION: 'attraction',
  RESTAURANT: 'restaurant',
  HOTEL: 'hotel',
} as const;

/** 名称匹配合并最低置信度（低于则新建 pending） */
export const ATTRACTION_MATCH_MERGE_THRESHOLD = 0.85;

/** LLM 来源景点票价可覆盖的天数阈值 */
export const ATTRACTION_LLM_PRICE_STALE_DAYS = 90;

/** 成就类型（achievement_code） */
export const AchievementType = {
  FIRST_CHECKIN: 'first_checkin',
  EXPLORER: 'explorer',
  VETERAN_TRAVELER: 'veteran_traveler',
  CITY_WANDERER: 'city_wanderer',
  CITY_CONQUEROR: 'city_conqueror',
  ROUTE_MASTER: 'route_master',
  PHOTO_STORY: 'photo_story',
  STREAK_WEEK: 'streak_week',
} as const;

/** 成就分类 */
export const AchievementCategory = {
  EXPLORE: 'explore',
  CHALLENGE: 'challenge',
  SOCIAL: 'social',
  CONSUME: 'consume',
} as const;

/** 成就解锁条件类型 */
export const AchievementConditionType = {
  CITY_CHECKIN: 'city_checkin',
  TOTAL_CHECKINS: 'total_checkins',
  DISTINCT_CITIES: 'distinct_cities',
  PHOTO_CHECKIN: 'photo_checkin',
  ROUTE_CHECKINS: 'route_checkins',
  CONSECUTIVE_DAYS: 'consecutive_days',
  DAILY_CHECKINS: 'daily_checkins',
} as const;

/** 徽章分类 */
export const BadgeCategory = {
  CITY: 'city',
  ACHIEVEMENT: 'achievement',
  SPECIAL: 'special',
  LEVEL: 'level',
} as const;

/** 徽章稀有度 */
export const BadgeRarity = {
  COMMON: 'common',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
} as const;

/** 徽章解锁条件类型 */
export const BadgeConditionType = {
  CITY_CHECKIN: 'city_checkin',
  TOTAL_CHECKINS: 'total_checkins',
  DISTINCT_CITIES: 'distinct_cities',
  PHOTO_CHECKIN: 'photo_checkin',
  ROUTE_CHECKINS: 'route_checkins',
} as const;

/** 打卡基础积分 */
export const CHECKIN_BASE_POINTS = 10;

/** 打卡附带照片额外积分 */
export const CHECKIN_PHOTO_BONUS = 5;

/** 首次打卡某景点额外积分 */
export const CHECKIN_FIRST_ATTRACTION_BONUS = 10;

/** 单条打卡最多上传照片数 */
export const CHECKIN_MAX_PHOTOS = 3;

/** 旅行照片单张大小上限（J1 默认 10MB） */
export const TRAVEL_PHOTO_MAX_FILE_BYTES = 10 * 1024 * 1024;

/** 旅程相册状态 */
export const JourneyAlbumStatus = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;

/** 旅行照片来源 */
export const TravelPhotoSource = {
  UPLOAD: 'upload',
  CHECKIN: 'checkin',
  IMPORT: 'import',
} as const;

/** 地理围栏有效打卡半径（米） */
export const CHECKIN_GEOFENCE_RADIUS_M = 500;

/** GPS 精度上限（米），超过则拒绝打卡 */
export const CHECKIN_GPS_MAX_ACCURACY_M = 100;

/** 相邻两次打卡最大合理速度（km/h），用于简单防作弊 */
export const CHECKIN_MAX_SPEED_KMH = 300;

/** 速度检测最小时间间隔（秒），低于此间隔不检测 */
export const CHECKIN_SPEED_MIN_INTERVAL_SEC = 30;

/** 排行榜周期 */
export const LeaderboardPeriod = {
  WEEK: 'week',
  MONTH: 'month',
} as const;

/** 排行榜指标 */
export const LeaderboardMetric = {
  CHECKINS: 'checkins',
  POINTS: 'points',
} as const;

/** 排行榜默认返回条数 */
export const LEADERBOARD_DEFAULT_LIMIT = 50;

/** 排行榜最大返回条数 */
export const LEADERBOARD_MAX_LIMIT = 100;

/** 埋点事件分类 */
export const AnalyticsEventCategory = {
  BUSINESS: 'business',
  BEHAVIOR: 'behavior',
  SYSTEM: 'system',
} as const;

/** 埋点来源端 */
export const AnalyticsEventSource = {
  SERVER: 'server',
  MOBILE: 'mobile',
  PC: 'pc',
  WEB: 'web',
} as const;
