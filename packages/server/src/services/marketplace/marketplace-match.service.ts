import {
  ApiError,
  ApiMessageKey,
  CertStatus,
  DEFAULT_MATCH_WEIGHTS,
  type MatchWeightConfig,
  type MarketplaceMatchCandidate,
} from '@douxing/shared';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { serviceDemand } from '../../db/schema/marketplace-demand.js';
import { serviceProvider } from '../../db/schema/marketplace-provider.js';
import { createDemandMatchNotifications } from './marketplace-notification.service.js';

/** 当前进程内可覆盖的匹配权重（验收脚本可临时改写） */
let matchWeights: MatchWeightConfig = { ...DEFAULT_MATCH_WEIGHTS };

type DemandMatchInput = {
  id: number;
  publisherUserId: number;
  categoryCode: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
};

/**
 * 将需求表日期字段规范为 `YYYY-MM-DD` 字符串或 `null`。
 *
 * @param value - Drizzle date / Date / string
 * @returns 日期字符串；空为 `null`
 */
function toDateString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

/**
 * 按 ID 读取匹配所需的需求字段。
 *
 * @param demandId - 需求 ID
 * @returns 匹配输入；不存在为 `null`
 */
async function loadDemandForMatch(demandId: number): Promise<DemandMatchInput | null> {
  const db = getDb();
  const rows = await db.select().from(serviceDemand).where(eq(serviceDemand.id, demandId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    publisherUserId: row.publisherUserId,
    categoryCode: row.categoryCode,
    title: row.title,
    destination: row.destination ?? null,
    startDate: toDateString(row.startDate),
    endDate: toDateString(row.endDate),
  };
}

/**
 * 读取当前匹配权重配置。
 *
 * @returns 类目 / 区域 / 档期权重副本
 */
export function getMatchWeights(): MatchWeightConfig {
  return { ...matchWeights };
}

/**
 * 覆盖匹配权重（须为正数；用于配置或验收）。
 *
 * @param weights - 新权重；未传字段保留原值
 * @returns 更新后的权重
 * @throws {ApiError} 权重非法（非正数）
 */
export function setMatchWeights(weights: Partial<MatchWeightConfig>): MatchWeightConfig {
  const next: MatchWeightConfig = {
    category: weights.category ?? matchWeights.category,
    region: weights.region ?? matchWeights.region,
    schedule: weights.schedule ?? matchWeights.schedule,
  };
  if (next.category <= 0 || next.region <= 0 || next.schedule <= 0) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_MATCH_WEIGHTS_INVALID);
  }
  matchWeights = next;
  return getMatchWeights();
}

/**
 * 将匹配权重恢复为 shared 默认值。
 *
 * @returns 默认权重副本
 */
export function resetMatchWeights(): MatchWeightConfig {
  matchWeights = { ...DEFAULT_MATCH_WEIGHTS };
  return getMatchWeights();
}

/**
 * 判断服务者服务区域是否覆盖需求目的地（子串互含，大小写不敏感）。
 *
 * @param destination - 需求目的地；空则视为区域维度通过
 * @param serviceRegions - 服务者区域列表；空/null 视为未声明区域、不通过区域匹配
 * @returns 命中为 true
 */
export function matchesServiceRegion(
  destination: string | null | undefined,
  serviceRegions: string[] | null | undefined,
): boolean {
  const dest = destination?.trim();
  if (!dest) {
    return true;
  }
  if (!serviceRegions || serviceRegions.length === 0) {
    return false;
  }
  const normalizedDest = dest.toLowerCase();
  return serviceRegions.some((region) => {
    const r = region.trim().toLowerCase();
    if (!r) return false;
    return normalizedDest.includes(r) || r.includes(normalizedDest);
  });
}

/**
 * 档期占位规则：无服务方日历前，有日期与无日期一律通过（真冲突检测归 M7-3）。
 *
 * @param _startDate - 开始日期（占位，未使用）
 * @param _endDate - 结束日期（占位，未使用）
 * @returns 始终为 true
 */
export function matchesSchedulePlaceholder(
  _startDate: string | null | undefined,
  _endDate: string | null | undefined,
): boolean {
  return true;
}

/**
 * 对单个已认证服务者计算与需求的匹配分。
 *
 * @param demand - 需求匹配字段
 * @param provider - 含类目/区域的服务者行
 * @param weights - 权重配置
 * @returns 候选；类目未命中时返回 `null`（硬过滤）
 */
export function scoreProviderForDemand(
  demand: Pick<DemandMatchInput, 'categoryCode' | 'destination' | 'startDate' | 'endDate'>,
  provider: {
    id: number;
    userId: number;
    categoryCodes: string[];
    serviceRegions: string[] | null;
  },
  weights: MatchWeightConfig = matchWeights,
): MarketplaceMatchCandidate | null {
  const matchedCategory = provider.categoryCodes.includes(demand.categoryCode);
  if (!matchedCategory) {
    return null;
  }

  const matchedRegion = matchesServiceRegion(demand.destination, provider.serviceRegions);
  const matchedSchedule = matchesSchedulePlaceholder(demand.startDate, demand.endDate);

  let score = weights.category;
  if (matchedRegion) score += weights.region;
  if (matchedSchedule) score += weights.schedule;

  return {
    providerId: provider.id,
    userId: provider.userId,
    score,
    matchedCategory,
    matchedRegion,
    matchedSchedule,
  };
}

/**
 * 为指定需求匹配全部已认证服务者，按分数降序返回。
 *
 * @param demandId - 需求单 ID
 * @returns 匹配候选列表；无命中时为空数组
 * @throws {ApiError} 需求不存在
 */
export async function matchProvidersForDemand(demandId: number): Promise<MarketplaceMatchCandidate[]> {
  const demand = await loadDemandForMatch(demandId);
  if (!demand) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DEMAND_NOT_FOUND);
  }

  const db = getDb();
  const providers = await db
    .select()
    .from(serviceProvider)
    .where(eq(serviceProvider.certStatus, CertStatus.APPROVED));

  const candidates: MarketplaceMatchCandidate[] = [];
  for (const row of providers) {
    if (row.userId === demand.publisherUserId) {
      continue;
    }
    const scored = scoreProviderForDemand(
      demand,
      {
        id: row.id,
        userId: row.userId,
        categoryCodes: row.categoryCodes ?? [],
        serviceRegions: row.serviceRegions ?? null,
      },
      matchWeights,
    );
    if (scored) {
      candidates.push(scored);
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.providerId - b.providerId);
  return candidates;
}

/**
 * 发布后匹配服务者并写入站内通知（幂等：同用户同需求同类型不重复插入）。
 *
 * @param demandId - 已发布需求 ID
 * @returns 新写入的通知条数
 * @throws {ApiError} 需求不存在
 */
export async function matchAndNotifyProviders(demandId: number): Promise<number> {
  const demand = await loadDemandForMatch(demandId);
  if (!demand) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DEMAND_NOT_FOUND);
  }

  const candidates = await matchProvidersForDemand(demandId);
  const notifiable = candidates.filter((item) => item.matchedRegion);
  if (notifiable.length === 0) {
    return 0;
  }

  return createDemandMatchNotifications(
    notifiable.map((item) => ({
      userId: item.userId,
      demandId: demand.id,
      title: demand.title,
      score: item.score,
    })),
  );
}
