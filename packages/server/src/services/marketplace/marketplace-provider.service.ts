import { and, count, desc, eq, like, or } from 'drizzle-orm';
import {
  ApiMessageKey,
  ApiError,
  CertStatus,
  type CertStatusValue,
  ProviderType,
  isValidServiceCategoryCode,
  type ServiceProviderApplyInput,
  type ServiceProviderPublicProfile,
  type ServiceProviderReviewInput,
  type ServiceProviderSummary,
} from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { serviceProvider } from '../../db/schema/marketplace-provider.js';
import { syncMerchantRoleForUser } from './marketplace-merchant-role.service.js';
import { getBizOrgById } from './marketplace-org.service.js';

const BLOCKED_PROVIDER_REAPPLY: CertStatusValue[] = [CertStatus.PENDING, CertStatus.APPROVED];

/**
 * 将服务者行映射为 API 摘要 DTO。
 *
 * @param row - `service_provider` 表行
 * @returns 服务者摘要
 */
function toServiceProviderSummary(row: typeof serviceProvider.$inferSelect): ServiceProviderSummary {
  return {
    id: row.id,
    userId: row.userId,
    providerType: row.providerType as ServiceProviderSummary['providerType'],
    orgId: row.orgId,
    certStatus: row.certStatus as ServiceProviderSummary['certStatus'],
    creditScore: row.creditScore,
    categoryCodes: row.categoryCodes ?? [],
    serviceRegions: row.serviceRegions ?? null,
    displayName: row.displayName ?? null,
    bio: row.bio ?? null,
    portfolioUrls: row.portfolioUrls ?? null,
    reviewNote: row.reviewNote ?? null,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 校验个人服务者认证申请入参。
 *
 * @param input - 认证申请表单
 * @throws {ApiError} 参数无效时抛出
 */
function validateProviderApplyInput(input: ServiceProviderApplyInput): void {
  if (!Object.values(ProviderType).includes(input.providerType)) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PROVIDER_APPLY_INVALID);
  }
  if (!Array.isArray(input.categoryCodes) || input.categoryCodes.length === 0) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PROVIDER_APPLY_INVALID);
  }
  for (const code of input.categoryCodes) {
    if (!isValidServiceCategoryCode(code)) {
      throw new ApiError(ApiMessageKey.MARKETPLACE_CATEGORY_INVALID);
    }
  }
}

/**
 * 判断用户是否可提交服务者认证（无 pending/approved 记录，或 rejected 可重申）。
 *
 * @param userId - 用户 ID
 * @returns 已存在 blocking 记录则为 true
 */
export async function userHasBlockingProviderApplication(userId: number): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ certStatus: serviceProvider.certStatus })
    .from(serviceProvider)
    .where(eq(serviceProvider.userId, userId))
    .limit(1);
  const status = rows[0]?.certStatus;
  if (!status) return false;
  return BLOCKED_PROVIDER_REAPPLY.includes(status as CertStatusValue);
}

/**
 * 提交个人服务者认证申请。
 *
 * @param userId - 申请人用户 ID
 * @param input - 认证表单
 * @returns 服务者摘要（`cert_status=pending`）
 * @throws {ApiError} 重复申请或参数无效
 */
export async function applyServiceProvider(
  userId: number,
  input: ServiceProviderApplyInput,
): Promise<ServiceProviderSummary> {
  validateProviderApplyInput(input);

  if (input.orgId != null) {
    const org = await getBizOrgById(input.orgId);
    if (!org || org.status !== 'active') {
      throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_NOT_FOUND);
    }
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(serviceProvider)
    .where(eq(serviceProvider.userId, userId))
    .limit(1);
  const existingRow = existing[0];

  if (existingRow) {
    if (BLOCKED_PROVIDER_REAPPLY.includes(existingRow.certStatus as CertStatusValue)) {
      throw new ApiError(ApiMessageKey.MARKETPLACE_PROVIDER_ALREADY_APPLIED);
    }
    await db
      .update(serviceProvider)
      .set({
        providerType: input.providerType,
        orgId: input.orgId ?? null,
        certStatus: CertStatus.PENDING,
        categoryCodes: input.categoryCodes,
        serviceRegions: input.serviceRegions ?? null,
        displayName: input.displayName?.trim() || null,
        bio: input.bio?.trim() || null,
        portfolioUrls: input.portfolioUrls ?? null,
        reviewNote: null,
        reviewedAt: null,
        reviewedBy: null,
      })
      .where(eq(serviceProvider.id, existingRow.id));

    const updated = await db
      .select()
      .from(serviceProvider)
      .where(eq(serviceProvider.id, existingRow.id))
      .limit(1);
    await syncMerchantRoleForUser(userId);
    return toServiceProviderSummary(updated[0]!);
  }

  const [result] = await db.insert(serviceProvider).values({
    userId,
    providerType: input.providerType,
    orgId: input.orgId ?? null,
    certStatus: CertStatus.PENDING,
    categoryCodes: input.categoryCodes,
    serviceRegions: input.serviceRegions ?? null,
    displayName: input.displayName?.trim() || null,
    bio: input.bio?.trim() || null,
    portfolioUrls: input.portfolioUrls ?? null,
  });

  const rows = await db
    .select()
    .from(serviceProvider)
    .where(eq(serviceProvider.id, Number(result.insertId)))
    .limit(1);
  await syncMerchantRoleForUser(userId);
  return toServiceProviderSummary(rows[0]!);
}

/**
 * 读取当前用户的服务者档案。
 *
 * @param userId - 用户 ID
 * @returns 服务者摘要；未申请时 `null`
 */
export async function getServiceProviderByUserId(
  userId: number,
): Promise<ServiceProviderSummary | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(serviceProvider)
    .where(eq(serviceProvider.userId, userId))
    .limit(1);
  return rows[0] ? toServiceProviderSummary(rows[0]) : null;
}

/**
 * 按 ID 读取已通过认证的服务者公开主页。
 *
 * @param providerId - 服务者主键
 * @returns 公开档案；不存在或未通过时 `null`
 */
export async function getApprovedProviderPublicProfile(
  providerId: number,
): Promise<ServiceProviderPublicProfile | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(serviceProvider)
    .where(eq(serviceProvider.id, providerId))
    .limit(1);
  const row = rows[0];
  if (!row || row.certStatus !== CertStatus.APPROVED) {
    return null;
  }

  let orgName: string | null = null;
  if (row.orgId) {
    const org = await getBizOrgById(row.orgId);
    orgName = org?.name ?? null;
  }

  return {
    id: row.id,
    providerType: row.providerType as ServiceProviderPublicProfile['providerType'],
    orgId: row.orgId,
    orgName,
    displayName: row.displayName ?? null,
    bio: row.bio ?? null,
    categoryCodes: row.categoryCodes ?? [],
    serviceRegions: row.serviceRegions ?? null,
    portfolioUrls: row.portfolioUrls ?? null,
    creditScore: row.creditScore,
  };
}

/**
 * 管理端分页列出待审/全部服务者。
 *
 * @param options - 分页与筛选
 * @returns 分页结果
 */
export async function listServiceProvidersForAdminPage(options: {
  page: number;
  pageSize: number;
  certStatus?: string;
  keyword?: string;
  providerType?: string;
}): Promise<{ items: ServiceProviderSummary[]; total: number; page: number; pageSize: number }> {
  const db = getDb();
  const conditions = [];

  if (options.certStatus) {
    conditions.push(eq(serviceProvider.certStatus, options.certStatus));
  }
  if (options.providerType) {
    conditions.push(eq(serviceProvider.providerType, options.providerType));
  }
  if (options.keyword) {
    const pattern = `%${options.keyword}%`;
    conditions.push(
      or(like(serviceProvider.displayName, pattern), like(serviceProvider.bio, pattern)),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (options.page - 1) * options.pageSize;

  const [countRow] = await db
    .select({ total: count() })
    .from(serviceProvider)
    .where(whereClause);
  const total = Number(countRow?.total ?? 0);

  const rows = await db
    .select()
    .from(serviceProvider)
    .where(whereClause)
    .orderBy(desc(serviceProvider.id))
    .limit(options.pageSize)
    .offset(offset);

  return {
    items: rows.map(toServiceProviderSummary),
    total,
    page: options.page,
    pageSize: options.pageSize,
  };
}

/**
 * 平台审核个人服务者认证。
 *
 * @param providerId - 服务者 ID
 * @param reviewerUserId - 审核员用户 ID
 * @param input - 审核动作与备注
 * @returns 更新后的服务者摘要
 * @throws {ApiError} 非待审或不存在
 */
export async function reviewServiceProvider(
  providerId: number,
  reviewerUserId: number,
  input: ServiceProviderReviewInput,
): Promise<ServiceProviderSummary> {
  if (input.action !== 'approve' && input.action !== 'reject') {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_REVIEW_INVALID);
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(serviceProvider)
    .where(eq(serviceProvider.id, providerId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PROVIDER_NOT_FOUND);
  }
  if (row.certStatus !== CertStatus.PENDING) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PROVIDER_NOT_PENDING);
  }

  const nextStatus =
    input.action === 'approve' ? CertStatus.APPROVED : CertStatus.REJECTED;

  await db
    .update(serviceProvider)
    .set({
      certStatus: nextStatus,
      reviewNote: input.reviewNote?.trim() || null,
      reviewedAt: new Date(),
      reviewedBy: reviewerUserId,
    })
    .where(eq(serviceProvider.id, providerId));

  const updated = await db
    .select()
    .from(serviceProvider)
    .where(eq(serviceProvider.id, providerId))
    .limit(1);
  return toServiceProviderSummary(updated[0]!);
}

/**
 * 判断用户是否为已通过认证的服务者（具备报价资格）。
 *
 * @param userId - 用户 ID
 * @returns 已通过则为 true
 */
export async function isApprovedServiceProvider(userId: number): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: serviceProvider.id })
    .from(serviceProvider)
    .where(
      and(eq(serviceProvider.userId, userId), eq(serviceProvider.certStatus, CertStatus.APPROVED)),
    )
    .limit(1);
  return rows.length > 0;
}
