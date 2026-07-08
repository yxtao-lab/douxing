import { and, asc, desc, eq, sql, count } from 'drizzle-orm';
import type {
  PaginatedResult,
  TravelIntentSnapshot,
  WorkflowTemplateInfo,
  WorkflowTemplateNodeConfig,
} from '@douxing/shared';
import { ApiError, ApiMessageKey, buildPaginatedResult } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { workflowTemplates } from '../db/schema/workflow-templates.js';
import {
  DEFAULT_WORKFLOW_TEMPLATE_ID,
  WORKFLOW_TEMPLATE_SEEDS,
} from '../data/workflow-templates.seed.js';

export { DEFAULT_WORKFLOW_TEMPLATE_ID };

const CACHE_TTL_MS = 30_000;
let cache: { loadedAt: number; items: WorkflowTemplateInfo[] } | null = null;

/**
 * 将 DB 行转为 API 模板对象。
 *
 * @param row - Drizzle 查询行
 * @returns WorkflowTemplateInfo
 */
function rowToTemplate(row: typeof workflowTemplates.$inferSelect): WorkflowTemplateInfo {
  return {
    id: row.id,
    nameZh: row.nameZh,
    nameEn: row.nameEn,
    descriptionZh: row.descriptionZh,
    descriptionEn: row.descriptionEn,
    version: row.version,
    enabled: row.enabled === 1,
    priority: row.priority,
    selectionRules: row.selectionRules ?? true,
    nodeConfig: row.nodeConfig ?? {},
    abVariantBId: row.abVariantBId ?? null,
    abSplitPercent: row.abSplitPercent,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

/**
 * 清除模板内存缓存（CRUD 后调用）。
 *
 * @returns void
 */
export function invalidateWorkflowTemplateCache(): void {
  cache = null;
}

/**
 * 加载全部启用中的工作流模板（按 priority 降序）。
 *
 * @returns 启用模板列表；DB 空表时返回 seed 常量
 */
export async function loadEnabledWorkflowTemplates(): Promise<WorkflowTemplateInfo[]> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.items;
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.enabled, 1))
    .orderBy(desc(workflowTemplates.priority), asc(workflowTemplates.sortOrder));

  const items =
    rows.length > 0 ? rows.map(rowToTemplate) : WORKFLOW_TEMPLATE_SEEDS.filter((t) => t.enabled);
  cache = { loadedAt: now, items };
  return items;
}

/**
 * 按 ID 获取模板（含禁用项，管理端用）。
 *
 * @param id - 模板 slug
 * @returns 模板详情；不存在时 null
 */
export async function getWorkflowTemplateById(id: string): Promise<WorkflowTemplateInfo | null> {
  const db = getDb();
  const rows = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id)).limit(1);
  if (rows.length === 0) {
    const seed = WORKFLOW_TEMPLATE_SEEDS.find((item) => item.id === id);
    return seed ?? null;
  }
  return rowToTemplate(rows[0]!);
}

export interface ListWorkflowTemplatesQuery {
  enabled?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * 管理端分页列表。
 *
 * @param query - 筛选与分页
 * @returns 分页结果
 */
export async function listWorkflowTemplatesForAdmin(
  query: ListWorkflowTemplatesQuery = {},
): Promise<PaginatedResult<WorkflowTemplateInfo>> {
  const db = getDb();
  const page = query.page && query.page >= 1 ? Math.floor(query.page) : 1;
  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 200);
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (query.enabled !== undefined) {
    conditions.push(eq(workflowTemplates.enabled, query.enabled ? 1 : 0));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(workflowTemplates)
      .where(whereClause)
      .orderBy(desc(workflowTemplates.priority), asc(workflowTemplates.sortOrder))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(workflowTemplates).where(whereClause),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);
  if (total === 0 && page === 1 && query.enabled === undefined) {
    const seeds = WORKFLOW_TEMPLATE_SEEDS;
    return buildPaginatedResult(seeds, seeds.length, page, pageSize);
  }

  return buildPaginatedResult(rows.map(rowToTemplate), total, page, pageSize);
}

export interface UpsertWorkflowTemplateInput {
  id: string;
  nameZh: string;
  nameEn: string;
  descriptionZh?: string | null;
  descriptionEn?: string | null;
  version?: number;
  enabled?: boolean;
  priority?: number;
  selectionRules: Record<string, unknown> | boolean;
  nodeConfig: WorkflowTemplateNodeConfig;
  abVariantBId?: string | null;
  abSplitPercent?: number;
  sortOrder?: number;
}

/**
 * 新建工作流模板。
 *
 * @param input - 模板字段
 * @returns 创建后的模板
 * @throws {ApiError} ID 已存在
 */
export async function createWorkflowTemplate(
  input: UpsertWorkflowTemplateInput,
): Promise<WorkflowTemplateInfo> {
  const db = getDb();
  const existing = await db
    .select({ id: workflowTemplates.id })
    .from(workflowTemplates)
    .where(eq(workflowTemplates.id, input.id))
    .limit(1);
  if (existing.length > 0) {
    throw new ApiError(ApiMessageKey.WORKFLOW_TEMPLATE_ALREADY_EXISTS);
  }

  await db.insert(workflowTemplates).values({
    id: input.id,
    nameZh: input.nameZh,
    nameEn: input.nameEn,
    descriptionZh: input.descriptionZh ?? null,
    descriptionEn: input.descriptionEn ?? null,
    version: input.version ?? 1,
    enabled: input.enabled === false ? 0 : 1,
    priority: input.priority ?? 0,
    selectionRules: input.selectionRules,
    nodeConfig: input.nodeConfig,
    abVariantBId: input.abVariantBId ?? null,
    abSplitPercent: Math.min(Math.max(input.abSplitPercent ?? 0, 0), 99),
    sortOrder: input.sortOrder ?? 0,
  });

  invalidateWorkflowTemplateCache();
  const created = await getWorkflowTemplateById(input.id);
  if (!created) {
    throw new ApiError(ApiMessageKey.WORKFLOW_TEMPLATE_NOT_FOUND);
  }
  return created;
}

/**
 * 更新工作流模板（版本号自动 +1）。
 *
 * @param id - 模板 ID
 * @param patch - 部分字段
 * @returns 更新后的模板
 * @throws {ApiError} 模板不存在
 */
export async function updateWorkflowTemplate(
  id: string,
  patch: Partial<Omit<UpsertWorkflowTemplateInput, 'id'>>,
): Promise<WorkflowTemplateInfo> {
  const db = getDb();
  const rows = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id)).limit(1);
  if (rows.length === 0) {
    throw new ApiError(ApiMessageKey.WORKFLOW_TEMPLATE_NOT_FOUND);
  }

  const current = rows[0]!;
  const nextVersion = current.version + 1;

  await db
    .update(workflowTemplates)
    .set({
      nameZh: patch.nameZh ?? current.nameZh,
      nameEn: patch.nameEn ?? current.nameEn,
      descriptionZh: patch.descriptionZh !== undefined ? patch.descriptionZh : current.descriptionZh,
      descriptionEn: patch.descriptionEn !== undefined ? patch.descriptionEn : current.descriptionEn,
      version: nextVersion,
      enabled: patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : current.enabled,
      priority: patch.priority ?? current.priority,
      selectionRules: patch.selectionRules ?? current.selectionRules,
      nodeConfig: patch.nodeConfig ?? current.nodeConfig,
      abVariantBId:
        patch.abVariantBId !== undefined ? patch.abVariantBId : current.abVariantBId,
      abSplitPercent:
        patch.abSplitPercent !== undefined
          ? Math.min(Math.max(patch.abSplitPercent, 0), 99)
          : current.abSplitPercent,
      sortOrder: patch.sortOrder ?? current.sortOrder,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(workflowTemplates.id, id));

  invalidateWorkflowTemplateCache();
  const updated = await getWorkflowTemplateById(id);
  if (!updated) {
    throw new ApiError(ApiMessageKey.WORKFLOW_TEMPLATE_NOT_FOUND);
  }
  return updated;
}

/**
 * 删除工作流模板。
 *
 * @param id - 模板 ID
 * @returns void
 * @throws {ApiError} 模板不存在或为内置兜底模板
 */
export async function deleteWorkflowTemplate(id: string): Promise<void> {
  if (id === DEFAULT_WORKFLOW_TEMPLATE_ID) {
    throw new ApiError(ApiMessageKey.WORKFLOW_TEMPLATE_BUILTIN_PROTECTED);
  }

  const existing = await getWorkflowTemplateById(id);
  if (!existing) {
    throw new ApiError(ApiMessageKey.WORKFLOW_TEMPLATE_NOT_FOUND);
  }

  const db = getDb();
  await db.delete(workflowTemplates).where(eq(workflowTemplates.id, id));
  invalidateWorkflowTemplateCache();
}

/**
 * 将预置模板写入 DB（仅缺失 ID 时插入）。
 *
 * @returns 新插入条数
 */
export async function seedWorkflowTemplates(): Promise<number> {
  const db = getDb();
  let inserted = 0;

  for (const [index, template] of WORKFLOW_TEMPLATE_SEEDS.entries()) {
    const existing = await db
      .select({ id: workflowTemplates.id })
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, template.id))
      .limit(1);
    if (existing.length > 0) continue;

    await db.insert(workflowTemplates).values({
      id: template.id,
      nameZh: template.nameZh,
      nameEn: template.nameEn,
      descriptionZh: template.descriptionZh ?? null,
      descriptionEn: template.descriptionEn ?? null,
      version: template.version,
      enabled: template.enabled ? 1 : 0,
      priority: template.priority,
      selectionRules: template.selectionRules,
      nodeConfig: template.nodeConfig,
      abVariantBId: template.abVariantBId ?? null,
      abSplitPercent: template.abSplitPercent,
      sortOrder: template.sortOrder ?? index,
    });
    inserted += 1;
  }

  if (inserted > 0) {
    invalidateWorkflowTemplateCache();
  }
  return inserted;
}

/**
 * 从 intent 推断 budgetTier（供 JSON Logic 使用）。
 *
 * @param intent - 旅行意图快照
 * @returns low / medium / high / unknown
 */
export function resolveBudgetTierFromIntent(
  intent: TravelIntentSnapshot | Record<string, unknown> | null | undefined,
): 'low' | 'medium' | 'high' | 'unknown' {
  if (!intent) return 'unknown';
  const max = typeof intent.budgetMax === 'number' ? intent.budgetMax : null;
  const min = typeof intent.budgetMin === 'number' ? intent.budgetMin : null;
  const budget = typeof intent.budget === 'string' ? intent.budget.toLowerCase() : '';

  if (budget.includes('低') || budget.includes('low') || budget.includes('穷')) return 'low';
  if (budget.includes('高') || budget.includes('high') || budget.includes('luxury')) return 'high';

  const anchor = max ?? min;
  if (anchor == null) return 'unknown';
  if (anchor <= 3000) return 'low';
  if (anchor >= 8000) return 'high';
  return 'medium';
}
