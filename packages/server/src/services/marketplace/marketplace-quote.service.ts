import { and, desc, eq } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  BizOrgStatus,
  DemandStatus,
  QuoteStatus,
  type DemandQuoteCreateInput,
  type DemandQuoteSummary,
} from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { bizOrg } from '../../db/schema/marketplace-biz-org.js';
import { demandQuote, serviceDemand } from '../../db/schema/marketplace-demand.js';
import { serviceProvider } from '../../db/schema/marketplace-provider.js';
import { getOrgRoleForUser } from './marketplace-org-onboard.service.js';
import { getDemandById } from './marketplace-demand.service.js';
import { isApprovedServiceProvider } from './marketplace-provider.service.js';

const QUOTABLE_DEMAND_STATUSES = [DemandStatus.PUBLISHED, DemandStatus.QUOTING] as const;

/**
 * 将报价行映射为 API 摘要 DTO。
 *
 * @param row - `demand_quote` 表行
 * @param orgName - 商户名称；无 org 时为 `null`
 * @param providerDisplayName - 服务者展示名；无个人服务者时为 `null`
 * @returns 报价摘要
 */
function toQuoteSummary(
  row: typeof demandQuote.$inferSelect,
  orgName: string | null,
  providerDisplayName: string | null,
): DemandQuoteSummary {
  return {
    id: row.id,
    demandId: row.demandId,
    orgId: row.orgId,
    orgName,
    providerUserId: row.providerUserId,
    providerDisplayName,
    amount: String(row.amount),
    proposalText: row.proposalText ?? null,
    status: row.status as DemandQuoteSummary['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 校验报价金额字符串是否合法。
 *
 * @param amount - 金额字符串
 * @returns 合法为 true
 */
function isValidAmount(amount: string): boolean {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0;
}

/**
 * 判断需求单当前是否开放报价。
 *
 * @param status - 需求单状态
 * @returns 可报价为 true
 */
export function isDemandQuotable(status: string): boolean {
  return (QUOTABLE_DEMAND_STATUSES as readonly string[]).includes(status);
}

/**
 * 为已发布需求提交报价（商户或个人服务者二选一）。
 *
 * @param demandId - 需求单 ID
 * @param userId - 报价方用户 ID
 * @param input - 报价表单
 * @returns 新建报价摘要
 * @throws {ApiError} 需求不可报价、资格不足、重复报价或参数无效
 */
export async function createDemandQuote(
  demandId: number,
  userId: number,
  input: DemandQuoteCreateInput,
): Promise<DemandQuoteSummary> {
  if (!isValidAmount(input.amount)) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_QUOTE_INVALID);
  }

  const demand = await getDemandById(demandId);
  if (!demand) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DEMAND_NOT_FOUND);
  }
  if (!isDemandQuotable(demand.status)) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_DEMAND_NOT_QUOTABLE);
  }
  if (demand.publisherUserId === userId) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_QUOTE_INVALID);
  }

  const db = getDb();
  let orgId: number | null = input.orgId ?? null;
  let providerUserId: number | null = null;

  if (orgId != null) {
    const orgRows = await db.select().from(bizOrg).where(eq(bizOrg.id, orgId)).limit(1);
    const org = orgRows[0];
    if (!org || org.status !== BizOrgStatus.ACTIVE) {
      throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_NOT_FOUND);
    }
    const role = await getOrgRoleForUser(userId, orgId);
    if (!role) {
      throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_MEMBER_FORBIDDEN);
    }
    providerUserId = null;
  } else {
    const approved = await isApprovedServiceProvider(userId);
    if (!approved) {
      throw new ApiError(ApiMessageKey.MARKETPLACE_PROVIDER_NOT_APPROVED);
    }
    providerUserId = userId;
    orgId = null;
  }

  const duplicateConditions = orgId != null
    ? and(eq(demandQuote.demandId, demandId), eq(demandQuote.orgId, orgId))
    : and(eq(demandQuote.demandId, demandId), eq(demandQuote.providerUserId, providerUserId!));

  const existing = await db.select({ id: demandQuote.id }).from(demandQuote).where(duplicateConditions).limit(1);
  if (existing[0]) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_QUOTE_ALREADY_EXISTS);
  }

  const [insertResult] = await db.insert(demandQuote).values({
    demandId,
    orgId,
    providerUserId,
    amount: input.amount,
    proposalText: input.proposalText?.trim() || null,
    status: QuoteStatus.PENDING,
  });
  const quoteId = Number(insertResult.insertId);

  if (demand.status === DemandStatus.PUBLISHED) {
    await db
      .update(serviceDemand)
      .set({ status: DemandStatus.QUOTING })
      .where(eq(serviceDemand.id, demandId));
  }

  const quoteRows = await db.select().from(demandQuote).where(eq(demandQuote.id, quoteId)).limit(1);
  const quoteRow = quoteRows[0]!;

  let orgName: string | null = null;
  if (orgId != null) {
    const orgRows = await db.select({ name: bizOrg.name }).from(bizOrg).where(eq(bizOrg.id, orgId)).limit(1);
    orgName = orgRows[0]?.name ?? null;
  }

  let providerDisplayName: string | null = null;
  if (providerUserId != null) {
    const providerRows = await db
      .select({ displayName: serviceProvider.displayName })
      .from(serviceProvider)
      .where(eq(serviceProvider.userId, providerUserId))
      .limit(1);
    providerDisplayName = providerRows[0]?.displayName ?? null;
  }

  return toQuoteSummary(quoteRow, orgName, providerDisplayName);
}

/**
 * 列出需求单下的全部报价（仅发单方或平台管理端应调用）。
 *
 * @param demandId - 需求单 ID
 * @returns 按创建时间倒序的报价列表；无记录时为空数组
 */
export async function listQuotesForDemand(demandId: number): Promise<DemandQuoteSummary[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(demandQuote)
    .where(eq(demandQuote.demandId, demandId))
    .orderBy(desc(demandQuote.createdAt));

  const result: DemandQuoteSummary[] = [];
  for (const row of rows) {
    let orgName: string | null = null;
    if (row.orgId != null) {
      const orgRows = await db.select({ name: bizOrg.name }).from(bizOrg).where(eq(bizOrg.id, row.orgId)).limit(1);
      orgName = orgRows[0]?.name ?? null;
    }
    let providerDisplayName: string | null = null;
    if (row.providerUserId != null) {
      const providerRows = await db
        .select({ displayName: serviceProvider.displayName })
        .from(serviceProvider)
        .where(eq(serviceProvider.userId, row.providerUserId))
        .limit(1);
      providerDisplayName = providerRows[0]?.displayName ?? null;
    }
    result.push(toQuoteSummary(row, orgName, providerDisplayName));
  }
  return result;
}

/**
 * 按 ID 读取报价记录。
 *
 * @param quoteId - 报价 ID
 * @returns 报价行；不存在时 `null`
 */
export async function getQuoteRowById(quoteId: number): Promise<typeof demandQuote.$inferSelect | null> {
  const db = getDb();
  const rows = await db.select().from(demandQuote).where(eq(demandQuote.id, quoteId)).limit(1);
  return rows[0] ?? null;
}
