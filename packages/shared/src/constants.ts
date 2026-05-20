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

/** 路线状态（travel_routes.status） */
export const RouteStatus = {
  DRAFT: 0,
  PUBLISHED: 1,
  ARCHIVED: 2,
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

/** 成就类型 */
export const AchievementType = {
  FIRST_CHECKIN: 'first_checkin',
  EXPLORER: 'explorer',
  ROUTE_MASTER: 'route_master',
} as const;
