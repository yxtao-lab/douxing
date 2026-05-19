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
