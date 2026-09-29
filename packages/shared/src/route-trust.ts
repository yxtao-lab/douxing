import { RouteContentTier, RouteSourceKind, RouteVerificationStatus } from './constants.js';
import {
  ROUTE_STALE_DAYS,
  ROUTE_TRUST_STALE_PENALTY,
  computeOpenReportPenalty,
  isRouteStale,
} from './ugc-anti-abuse.js';

/** U3：履约上限人数（独立打卡用户，超出不再加分） */
export const ROUTE_TRUST_FULFILLMENT_USERS_CAP = 5;

/** U3：共识上限（fork 次数） */
export const ROUTE_TRUST_CONSENSUS_FORK_CAP = 3;

/** U3：时效窗口（天） */
export const ROUTE_TRUST_RECENCY_DAYS = 30;

/** U3：进入可出行稿的可信门槛（0～100 分制） */
export const ROUTE_TRAVEL_READY_THRESHOLD = 60;

/** U3：爬取且未核验时的扣分 */
export const ROUTE_TRUST_CRAWL_UNVERIFIED_PENALTY = 30;

/**
 * U3：可信度各维满分（合计 100，再扣罚分）。
 * 与热度权重分离，禁止混用。
 */
export const ROUTE_TRUST_MAX = {
  FULFILLMENT: 40,
  RECENCY: 20,
  CONSENSUS: 15,
  QUALITY: 25,
} as const;

/** 可解释原因码（前端 i18n，禁止把中文写进库） */
export type RouteTrustReasonKey =
  | 'fulfillment'
  | 'recency_verified'
  | 'recency_fresh'
  | 'consensus'
  | 'quality_structure'
  | 'quality_description'
  | 'quality_bound_poi'
  | 'crawl_unverified'
  | 'stale'
  | 'open_reports'
  | 'crowned';

/** 落库 / API 的可信度拆解 */
export interface RouteTrustBreakdown {
  fulfillment: number;
  recency: number;
  consensus: number;
  quality: number;
  penalty: number;
  total: number;
  reasonKeys: RouteTrustReasonKey[];
}

/** 计算可信度所需信号（由服务层从打卡/fork/行程 JSON 采集） */
export interface RouteTrustSignals {
  uniqueCheckInUsers: number;
  updatedAtMs: number;
  nowMs: number;
  verificationStatus?: string | null;
  sourceKind?: string | null;
  forkCount: number;
  structuredDayCount: number;
  poiCount: number;
  boundPoiCount: number;
  hasDescription: boolean;
  trustCrowned?: boolean;
  /** U5：未结案报错条数 */
  openReportCount?: number;
  /** U5：运营强制降级为灵感稿 */
  forceInspiration?: boolean;
  /** U5：过期天数阈值，默认 ROUTE_STALE_DAYS */
  staleDays?: number;
}

export interface RouteTrustResult {
  score: number;
  breakdown: RouteTrustBreakdown;
  contentTier: 'inspiration' | 'travel_ready';
}

/**
 * 从 routeDetail JSON 提取内容质量信号。
 *
 * @param routeDetail - 行程 JSON
 * @param description - 路线简介
 * @returns 结构化天数、POI 数、绑定景点库数
 */
export function extractRouteQualitySignals(
  routeDetail: unknown,
  description?: string | null,
): Pick<
  RouteTrustSignals,
  'structuredDayCount' | 'poiCount' | 'boundPoiCount' | 'hasDescription'
> {
  const raw =
    routeDetail && typeof routeDetail === 'object'
      ? (routeDetail as Record<string, unknown>)
      : {};
  const days = Array.isArray(raw.days) ? raw.days : [];
  let structuredDayCount = 0;
  let poiCount = 0;
  let boundPoiCount = 0;
  for (const day of days) {
    if (!day || typeof day !== 'object') continue;
    const attractions = (day as { attractions?: unknown }).attractions;
    if (!Array.isArray(attractions) || attractions.length === 0) continue;
    structuredDayCount += 1;
    for (const spot of attractions) {
      if (!spot || typeof spot !== 'object') continue;
      poiCount += 1;
      const attractionId = (spot as { attractionId?: unknown }).attractionId;
      if (typeof attractionId === 'number' && attractionId > 0) {
        boundPoiCount += 1;
      }
    }
  }
  return {
    structuredDayCount,
    poiCount,
    boundPoiCount,
    hasDescription: Boolean(description?.trim()),
  };
}

/**
 * 爬取源且未核验时不可进入可出行池。
 *
 * @param sourceKind - 来源
 * @param verificationStatus - 核验状态
 * @returns 是否被拦截
 */
export function isCrawlUnverifiedForTravelReady(
  sourceKind: string | null | undefined,
  verificationStatus: string | null | undefined,
): boolean {
  return (
    sourceKind === RouteSourceKind.CRAWL &&
    verificationStatus !== RouteVerificationStatus.VERIFIED
  );
}

/**
 * 按可解释维度计算可信度，并判定内容层级（与热度分完全独立）。
 * U5：叠加过期与未结案报错扣分。
 *
 * @param signals - 履约/时效/共识/质量/报错信号
 * @returns 总分、拆解、建议层级
 */
export function computeRouteTrust(signals: RouteTrustSignals): RouteTrustResult {
  const reasonKeys: RouteTrustReasonKey[] = [];

  const uniqueUsers = Math.max(0, Number(signals.uniqueCheckInUsers) || 0);
  const fulfillment = Math.round(
    (Math.min(uniqueUsers, ROUTE_TRUST_FULFILLMENT_USERS_CAP) / ROUTE_TRUST_FULFILLMENT_USERS_CAP) *
      ROUTE_TRUST_MAX.FULFILLMENT,
  );
  if (fulfillment > 0) reasonKeys.push('fulfillment');

  let recency = 0;
  if (signals.verificationStatus === RouteVerificationStatus.VERIFIED) {
    recency += 10;
    reasonKeys.push('recency_verified');
  }
  const recencyWindowMs = ROUTE_TRUST_RECENCY_DAYS * 24 * 60 * 60 * 1000;
  if (signals.nowMs - signals.updatedAtMs <= recencyWindowMs) {
    recency += 10;
    reasonKeys.push('recency_fresh');
  }
  recency = Math.min(ROUTE_TRUST_MAX.RECENCY, recency);

  const forks = Math.max(0, Number(signals.forkCount) || 0);
  const consensus = Math.round(
    (Math.min(forks, ROUTE_TRUST_CONSENSUS_FORK_CAP) / ROUTE_TRUST_CONSENSUS_FORK_CAP) *
      ROUTE_TRUST_MAX.CONSENSUS,
  );
  if (consensus > 0) reasonKeys.push('consensus');

  let quality = 0;
  if (signals.structuredDayCount >= 1) {
    quality += 10;
    reasonKeys.push('quality_structure');
  }
  if (signals.hasDescription) {
    quality += 5;
    reasonKeys.push('quality_description');
  }
  if (signals.poiCount > 0) {
    const boundRatio = signals.boundPoiCount / signals.poiCount;
    if (boundRatio > 0) {
      quality += Math.round(boundRatio * 10);
      reasonKeys.push('quality_bound_poi');
    }
  }
  quality = Math.min(ROUTE_TRUST_MAX.QUALITY, quality);

  const crawlBlocked = isCrawlUnverifiedForTravelReady(
    signals.sourceKind,
    signals.verificationStatus,
  );
  let penalty = crawlBlocked ? ROUTE_TRUST_CRAWL_UNVERIFIED_PENALTY : 0;
  if (penalty > 0) reasonKeys.push('crawl_unverified');

  const staleDays = signals.staleDays ?? ROUTE_STALE_DAYS;
  if (isRouteStale(signals.updatedAtMs, signals.nowMs, staleDays)) {
    penalty += ROUTE_TRUST_STALE_PENALTY;
    reasonKeys.push('stale');
  }

  const openReportPenalty = computeOpenReportPenalty(signals.openReportCount ?? 0);
  if (openReportPenalty > 0) {
    penalty += openReportPenalty;
    reasonKeys.push('open_reports');
  }

  let total = Math.max(0, fulfillment + recency + consensus + quality - penalty);
  if (signals.trustCrowned && !crawlBlocked) {
    total = Math.max(total, ROUTE_TRAVEL_READY_THRESHOLD);
    reasonKeys.push('crowned');
  }

  const breakdown: RouteTrustBreakdown = {
    fulfillment,
    recency,
    consensus,
    quality,
    penalty,
    total,
    reasonKeys,
  };

  let contentTier: 'inspiration' | 'travel_ready' = RouteContentTier.INSPIRATION;
  if (
    !crawlBlocked &&
    !signals.forceInspiration &&
    (signals.trustCrowned || total >= ROUTE_TRAVEL_READY_THRESHOLD)
  ) {
    contentTier = RouteContentTier.TRAVEL_READY;
  }

  return { score: total, breakdown, contentTier };
}
