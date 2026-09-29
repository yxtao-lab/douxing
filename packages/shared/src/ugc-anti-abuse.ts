/**
 * U5：UGC 反作弊与过期降权集中配置（禁止业务散落魔法数）。
 */

/** 互动 / 打卡频控窗口与上限 */
export const UGC_RATE_LIMITS = {
  /** 点赞：每小时次数 */
  LIKE_PER_HOUR: 30,
  LIKE_WINDOW_SEC: 3600,
  /** 评论：每小时次数 */
  COMMENT_PER_HOUR: 10,
  COMMENT_WINDOW_SEC: 3600,
  /** 报错：每天次数 */
  REPORT_PER_DAY: 5,
  REPORT_WINDOW_SEC: 24 * 3600,
  /** 打卡：每天总次数（与同景点当日互斥叠加） */
  CHECKIN_PER_DAY: 20,
  CHECKIN_WINDOW_SEC: 24 * 3600,
} as const;

/** 超过该天数未更新视为过期，可信度扣分 */
export const ROUTE_STALE_DAYS = 90;

/** U5：过期扣分 */
export const ROUTE_TRUST_STALE_PENALTY = 25;

/** U5：每条未结案报错扣分 */
export const ROUTE_TRUST_OPEN_REPORT_PENALTY = 10;

/** U5：未结案报错扣分上限 */
export const ROUTE_TRUST_OPEN_REPORT_PENALTY_CAP = 30;

/** 报错原因 */
export const RouteReportReason = {
  OUTDATED: 'outdated',
  DANGEROUS: 'dangerous',
  PLAGIARISM: 'plagiarism',
  AD: 'ad',
  OTHER: 'other',
} as const;

export type RouteReportReasonValue =
  (typeof RouteReportReason)[keyof typeof RouteReportReason];

const ROUTE_REPORT_REASON_SET = new Set<string>(Object.values(RouteReportReason));

/**
 * 判断是否为合法报错原因。
 *
 * @param value - 原始值
 * @returns 是否合法
 */
export function isRouteReportReason(value: string): value is RouteReportReasonValue {
  return ROUTE_REPORT_REASON_SET.has(value);
}

/** 报错处理状态 */
export const RouteReportStatus = {
  OPEN: 'open',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
} as const;

export type RouteReportStatusValue =
  (typeof RouteReportStatus)[keyof typeof RouteReportStatus];

/** 管理端抽检处置动作 */
export const RouteModerationAction = {
  DEMOTE: 'demote',
  HIDE: 'hide',
  RESTORE: 'restore',
  CROWN: 'crown',
  UNCROWN: 'uncrown',
} as const;

export type RouteModerationActionValue =
  (typeof RouteModerationAction)[keyof typeof RouteModerationAction];

const ROUTE_MODERATION_ACTION_SET = new Set<string>(Object.values(RouteModerationAction));

/**
 * 判断是否为合法管理处置动作。
 *
 * @param value - 原始值
 * @returns 是否合法
 */
export function isRouteModerationAction(value: string): value is RouteModerationActionValue {
  return ROUTE_MODERATION_ACTION_SET.has(value);
}

/**
 * 计算未结案报错带来的可信扣分。
 *
 * @param openReportCount - 未结案报错条数
 * @returns 扣分（0～上限）
 */
export function computeOpenReportPenalty(openReportCount: number): number {
  const n = Math.max(0, Math.floor(Number(openReportCount) || 0));
  return Math.min(ROUTE_TRUST_OPEN_REPORT_PENALTY_CAP, n * ROUTE_TRUST_OPEN_REPORT_PENALTY);
}

/**
 * 判断路线是否已过期（相对 nowMs）。
 *
 * @param updatedAtMs - 最近更新时间戳
 * @param nowMs - 当前时间戳
 * @param staleDays - 过期天数，默认 ROUTE_STALE_DAYS
 * @returns 是否过期
 */
export function isRouteStale(
  updatedAtMs: number,
  nowMs: number,
  staleDays: number = ROUTE_STALE_DAYS,
): boolean {
  const windowMs = Math.max(1, staleDays) * 24 * 60 * 60 * 1000;
  return nowMs - updatedAtMs > windowMs;
}
