import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import {
  ApiMessageKey,
  type BizOrgSummary,
} from '@douxing/shared';
import { ApiError } from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { bizOrg } from '../../db/schema/marketplace-biz-org.js';

/**
 * 生成服务需求单业务编号（SD + 时间戳 + 随机段）。
 *
 * @returns 唯一需求单号，最长 32 字符
 */
export function generateDemandNo(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(2).toString('hex').toUpperCase();
  return `SD${ts}${rand}`;
}

/**
 * 生成服务履约订单业务编号（SO + 时间戳 + 随机段）。
 *
 * @returns 唯一订单号，最长 32 字符
 */
export function generateServiceOrderNo(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(2).toString('hex').toUpperCase();
  return `SO${ts}${rand}`;
}

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
 * 按 ID 读取商户组织（只读）。
 *
 * @param id - 商户组织主键
 * @returns 组织摘要；不存在时 `null`
 */
export async function getBizOrgById(id: number): Promise<BizOrgSummary | null> {
  const db = getDb();
  const rows = await db.select().from(bizOrg).where(eq(bizOrg.id, id)).limit(1);
  const row = rows[0];
  return row ? toBizOrgSummary(row) : null;
}

/**
 * 按 ID 读取商户组织，不存在时抛业务错误。
 *
 * @param id - 商户组织主键
 * @returns 组织摘要
 * @throws {ApiError} `MARKETPLACE_ORG_NOT_FOUND` 当记录不存在
 */
export async function requireBizOrgById(id: number): Promise<BizOrgSummary> {
  const org = await getBizOrgById(id);
  if (!org) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_NOT_FOUND);
  }
  return org;
}

/**
 * 管理端占位：列出商户组织（M0 返回全部或 seed 数据）。
 *
 * @returns 商户组织摘要列表，按 id 升序
 */
export async function listBizOrgsForAdmin(): Promise<BizOrgSummary[]> {
  const db = getDb();
  const rows = await db.select().from(bizOrg).orderBy(bizOrg.id);
  return rows.map(toBizOrgSummary);
}
