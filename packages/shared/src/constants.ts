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

/** 成就类型 */
export const AchievementType = {
  FIRST_CHECKIN: 'first_checkin',
  EXPLORER: 'explorer',
  ROUTE_MASTER: 'route_master',
} as const;
