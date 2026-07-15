import { and, count, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import {
  ApiMessageKey,
  ApiError,
  BizOrgStatus,
  BizOrgType,
  OrgDocumentType,
  OrgRole,
  isValidOrgDocumentType,
  type BizOrgApplyInput,
  type BizOrgDetail,
  type BizOrgDocumentSummary,
  type BizOrgReviewInput,
  type BizOrgSettlementConfig,
  type BizOrgSummary,
  type OrgMembershipSummary,
} from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { bizOrg, orgMember } from '../../db/schema/marketplace-biz-org.js';
import { bizOrgDocument } from '../../db/schema/marketplace-biz-org-documents.js';
import { syncMerchantRoleForUser } from './marketplace-merchant-role.service.js';

const ACTIVE_OWNER_STATUSES = [BizOrgStatus.PENDING, BizOrgStatus.ACTIVE] as const;

/**
 * 将商户组织行映射为 API 摘要 DTO。
 *
 * @param row - `biz_org` 表行
 * @returns 商户组织摘要
 */
function toBizOrgSummary(row: typeof bizOrg.$inferSelect): BizOrgSummary {
  return {
    id: row.id,
    name: row.name,
    orgType: row.orgType as BizOrgSummary['orgType'],
    licenseNo: row.licenseNo,
    status: row.status as BizOrgSummary['status'],
    contactPhone: row.contactPhone ?? null,
    description: row.description ?? null,
    reviewNote: row.reviewNote ?? null,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 将资质附件行映射为 API 摘要 DTO。
 *
 * @param row - `biz_org_documents` 表行
 * @returns 资质附件摘要
 */
function toBizOrgDocumentSummary(row: typeof bizOrgDocument.$inferSelect): BizOrgDocumentSummary {
  return {
    id: row.id,
    orgId: row.orgId,
    docType: row.docType as BizOrgDocumentSummary['docType'],
    fileUrl: row.fileUrl,
    fileName: row.fileName ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 校验商户入驻申请入参。
 *
 * @param input - 入驻申请体
 * @throws {ApiError} 字段无效时抛出 `MARKETPLACE_ORG_APPLY_INVALID` 或 `MARKETPLACE_DOCUMENT_INVALID`
 */
function validateBizOrgApplyInput(input: BizOrgApplyInput): void {
  if (!input.name?.trim() || input.name.trim().length > 128) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_APPLY_INVALID);
  }
  if (!Object.values(BizOrgType).includes(input.orgType)) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_APPLY_INVALID);
  }
  if (!Array.isArray(input.documents) || input.documents.length === 0) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_APPLY_INVALID);
  }
  const hasLicense = input.documents.some((doc) => doc.docType === OrgDocumentType.LICENSE);
  if (!hasLicense) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_APPLY_INVALID);
  }
  for (const doc of input.documents) {
    if (!isValidOrgDocumentType(doc.docType) || !doc.fileUrl?.trim()) {
      throw new ApiError(ApiMessageKey.MARKETPLACE_DOCUMENT_INVALID);
    }
  }
}

/**
 * 判断用户是否已作为 owner 拥有进行中或已激活的商户。
 *
 * @param userId - 用户 ID
 * @returns 已存在则为 true
 */
export async function userHasActiveOrgApplication(userId: number): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: orgMember.id })
    .from(orgMember)
    .innerJoin(bizOrg, eq(orgMember.orgId, bizOrg.id))
    .where(
      and(
        eq(orgMember.userId, userId),
        eq(orgMember.orgRole, OrgRole.OWNER),
        inArray(bizOrg.status, [...ACTIVE_OWNER_STATUSES]),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * 提交商户入驻申请：创建 `biz_org(pending)` 与 `org_member(owner)` 并写入资质附件。
 *
 * @param userId - 申请人用户 ID
 * @param input - 入驻申请表单
 * @returns 新建商户详情（含附件）
 * @throws {ApiError} 重复申请或参数无效
 */
export async function applyBizOrg(userId: number, input: BizOrgApplyInput): Promise<BizOrgDetail> {
  validateBizOrgApplyInput(input);

  if (await userHasActiveOrgApplication(userId)) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_ALREADY_APPLIED);
  }

  const db = getDb();
  const [orgResult] = await db.insert(bizOrg).values({
    name: input.name.trim(),
    orgType: input.orgType,
    licenseNo: input.licenseNo?.trim() || null,
    contactPhone: input.contactPhone?.trim() || null,
    description: input.description?.trim() || null,
    status: BizOrgStatus.PENDING,
  });
  const orgId = Number(orgResult.insertId);

  await db.insert(orgMember).values({
    userId,
    orgId,
    orgRole: OrgRole.OWNER,
  });

  if (input.documents.length > 0) {
    await db.insert(bizOrgDocument).values(
      input.documents.map((doc) => ({
        orgId,
        docType: doc.docType,
        fileUrl: doc.fileUrl.trim(),
        fileName: doc.fileName?.trim() || null,
      })),
    );
  }

  const detail = await getBizOrgDetailById(orgId);
  if (!detail) {
    throw new ApiError(ApiMessageKey.SERVER_ERROR);
  }
  await syncMerchantRoleForUser(userId);
  return detail;
}

/**
 * 按 ID 读取商户组织详情（含资质附件）。
 *
 * @param id - 商户组织主键
 * @returns 详情；不存在时 `null`
 */
export async function getBizOrgDetailById(id: number): Promise<BizOrgDetail | null> {
  const db = getDb();
  const rows = await db.select().from(bizOrg).where(eq(bizOrg.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const docs = await db
    .select()
    .from(bizOrgDocument)
    .where(eq(bizOrgDocument.orgId, id))
    .orderBy(bizOrgDocument.id);

  return {
    ...toBizOrgSummary(row),
    documents: docs.map(toBizOrgDocumentSummary),
  };
}

/**
 * 列出当前用户关联的商户成员关系。
 *
 * @param userId - 用户 ID
 * @returns 成员关系列表，按 org id 升序
 */
export async function listOrgMembershipsByUser(userId: number): Promise<OrgMembershipSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      orgId: orgMember.orgId,
      orgRole: orgMember.orgRole,
      org: bizOrg,
    })
    .from(orgMember)
    .innerJoin(bizOrg, eq(orgMember.orgId, bizOrg.id))
    .where(eq(orgMember.userId, userId))
    .orderBy(orgMember.orgId);

  return rows.map((row) => ({
    orgId: row.orgId,
    orgRole: row.orgRole as OrgMembershipSummary['orgRole'],
    org: toBizOrgSummary(row.org),
  }));
}

/**
 * 解析用户在指定商户中的成员角色。
 *
 * @param userId - 用户 ID
 * @param orgId - 商户 ID
 * @returns 角色字符串；非成员时 `null`
 */
export async function getOrgRoleForUser(
  userId: number,
  orgId: number,
): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ orgRole: orgMember.orgRole })
    .from(orgMember)
    .where(and(eq(orgMember.userId, userId), eq(orgMember.orgId, orgId)))
    .limit(1);
  return rows[0]?.orgRole ?? null;
}

/**
 * 管理端分页列出商户（支持状态与关键字筛选）。
 *
 * @param options - 分页与筛选参数
 * @returns 分页结果
 */
export async function listBizOrgsForAdminPage(options: {
  page: number;
  pageSize: number;
  status?: string;
  keyword?: string;
  orgType?: string;
}): Promise<{ items: BizOrgSummary[]; total: number; page: number; pageSize: number }> {
  const db = getDb();
  const conditions = [];

  if (options.status) {
    conditions.push(eq(bizOrg.status, options.status));
  }
  if (options.orgType) {
    conditions.push(eq(bizOrg.orgType, options.orgType));
  }
  if (options.keyword) {
    const pattern = `%${options.keyword}%`;
    conditions.push(or(like(bizOrg.name, pattern), like(bizOrg.licenseNo, pattern)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (options.page - 1) * options.pageSize;

  const [countRow] = await db
    .select({ total: count() })
    .from(bizOrg)
    .where(whereClause);
  const total = Number(countRow?.total ?? 0);

  const rows = await db
    .select()
    .from(bizOrg)
    .where(whereClause)
    .orderBy(desc(bizOrg.id))
    .limit(options.pageSize)
    .offset(offset);

  return {
    items: rows.map(toBizOrgSummary),
    total,
    page: options.page,
    pageSize: options.pageSize,
  };
}

/**
 * 平台审核商户入驻申请。
 *
 * @param orgId - 商户 ID
 * @param reviewerUserId - 审核员用户 ID
 * @param input - 审核动作与备注
 * @returns 更新后的商户详情
 * @throws {ApiError} 非待审状态或动作无效
 */
export async function reviewBizOrg(
  orgId: number,
  reviewerUserId: number,
  input: BizOrgReviewInput,
): Promise<BizOrgDetail> {
  if (input.action !== 'approve' && input.action !== 'reject') {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_REVIEW_INVALID);
  }

  const db = getDb();
  const rows = await db.select().from(bizOrg).where(eq(bizOrg.id, orgId)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_NOT_FOUND);
  }
  if (row.status !== BizOrgStatus.PENDING) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_NOT_PENDING);
  }

  const nextStatus =
    input.action === 'approve' ? BizOrgStatus.ACTIVE : BizOrgStatus.REJECTED;

  await db
    .update(bizOrg)
    .set({
      status: nextStatus,
      reviewNote: input.reviewNote?.trim() || null,
      reviewedAt: sql`NOW()`,
      reviewedBy: reviewerUserId,
    })
    .where(eq(bizOrg.id, orgId));

  const detail = await getBizOrgDetailById(orgId);
  if (!detail) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_NOT_FOUND);
  }
  return detail;
}

/**
 * 为商户批量写入资质附件记录（供上传后关联或申请时写入）。
 *
 * @param orgId - 商户 ID
 * @param documents - 附件列表
 * @returns 写入后的附件摘要列表
 */
export async function addBizOrgDocuments(
  orgId: number,
  documents: Array<{ docType: string; fileUrl: string; fileName?: string | null }>,
): Promise<BizOrgDocumentSummary[]> {
  if (documents.length === 0) return [];

  const db = getDb();
  await db.insert(bizOrgDocument).values(
    documents.map((doc) => ({
      orgId,
      docType: doc.docType,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName ?? null,
    })),
  );

  const rows = await db
    .select()
    .from(bizOrgDocument)
    .where(eq(bizOrgDocument.orgId, orgId))
    .orderBy(desc(bizOrgDocument.id))
    .limit(documents.length);

  return rows.map(toBizOrgDocumentSummary);
}

/**
 * 更新商户结算配置（抽佣费率等；owner/admin 可写，验收脚本可直接调）。
 *
 * @param orgId - 商户 ID
 * @param userId - 操作人；传 `null` 时跳过成员校验（仅测试/管理脚本）
 * @param config - 结算配置；会与现有配置浅合并
 * @returns 合并后的结算配置
 * @throws {ApiError} 商户不存在、无权或费率非法
 */
export async function updateOrgSettlementConfig(
  orgId: number,
  userId: number | null,
  config: BizOrgSettlementConfig,
): Promise<BizOrgSettlementConfig> {
  if (
    config.platformFeeRate != null &&
    (!Number.isFinite(config.platformFeeRate) ||
      config.platformFeeRate < 0 ||
      config.platformFeeRate > 1)
  ) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_SETTLEMENT_CONFIG_INVALID);
  }

  const db = getDb();
  const rows = await db.select().from(bizOrg).where(eq(bizOrg.id, orgId)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_NOT_FOUND);
  }

  if (userId != null) {
    const role = await getOrgRoleForUser(userId, orgId);
    if (role !== OrgRole.OWNER && role !== OrgRole.ADMIN) {
      throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_MEMBER_FORBIDDEN);
    }
  }

  const next: BizOrgSettlementConfig = {
    ...(row.settlementConfig ?? {}),
    ...config,
  };
  await db.update(bizOrg).set({ settlementConfig: next }).where(eq(bizOrg.id, orgId));
  return next;
}
