import { and, asc, count, desc, eq, like, or } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  BizOrgStatus,
  ProductStatus,
  PUBLIC_PRODUCT_STATUSES,
  isValidServiceCategoryCode,
  type PaginatedResult,
  type ServiceProductDetail,
  type ServiceProductHallQuery,
  type ServiceProductInput,
  type ServiceProductSkuSummary,
  type ServiceProductSummary,
} from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { bizOrg } from '../../db/schema/marketplace-biz-org.js';
import { serviceProduct, serviceProductSku } from '../../db/schema/marketplace-product.js';
import { getOrgRoleForUser } from './marketplace-org-onboard.service.js';

const WRITABLE_ORG_ROLES = new Set(['owner', 'admin', 'staff']);

/**
 * 校验金额字符串是否合法正数。
 *
 * @param amount - 金额
 * @returns 合法为 true
 */
function isValidPrice(amount: string): boolean {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0;
}

/**
 * 将 SKU 行映射为摘要 DTO。
 *
 * @param row - SKU 表行
 * @returns SKU 摘要
 */
function toSkuSummary(row: typeof serviceProductSku.$inferSelect): ServiceProductSkuSummary {
  return {
    id: row.id,
    productId: row.productId,
    name: row.name,
    price: String(row.price),
    stock: row.stock,
    sortOrder: row.sortOrder,
  };
}

/**
 * 将标品行映射为列表摘要。
 *
 * @param row - 标品表行
 * @param orgName - 商户名
 * @param minPrice - 最低 SKU 价；无则 `null`
 * @returns 标品摘要
 */
function toProductSummary(
  row: typeof serviceProduct.$inferSelect,
  orgName: string | null,
  minPrice: string | null,
): ServiceProductSummary {
  return {
    id: row.id,
    orgId: row.orgId,
    orgName,
    categoryCode: row.categoryCode,
    title: row.title,
    coverUrl: row.coverUrl ?? null,
    destination: row.destination ?? null,
    status: row.status as ServiceProductSummary['status'],
    minPrice,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 校验标品入参并规范化 SKU 列表。
 *
 * @param input - 创建/更新入参
 * @returns 规范化后的 SKU 列表
 * @throws {ApiError} 类目/标题/SKU 非法
 */
function validateProductInput(input: ServiceProductInput) {
  if (!isValidServiceCategoryCode(input.categoryCode)) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_CATEGORY_INVALID);
  }
  if (!input.title?.trim()) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PRODUCT_INVALID);
  }
  if (!input.skus || input.skus.length === 0) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PRODUCT_INVALID);
  }
  for (const sku of input.skus) {
    if (!sku.name?.trim() || !isValidPrice(sku.price) || !Number.isInteger(sku.stock) || sku.stock < 0) {
      throw new ApiError(ApiMessageKey.MARKETPLACE_PRODUCT_INVALID);
    }
  }
  return input.skus.map((sku, index) => ({
    name: sku.name.trim(),
    price: sku.price,
    stock: sku.stock,
    sortOrder: sku.sortOrder ?? index,
  }));
}

/**
 * 断言用户可管理指定商户的标品。
 *
 * @param userId - 用户 ID
 * @param orgId - 商户 ID
 * @throws {ApiError} 商户不存在/非 active/无权
 */
async function assertCanManageOrgProducts(userId: number, orgId: number): Promise<void> {
  const db = getDb();
  const orgRows = await db.select().from(bizOrg).where(eq(bizOrg.id, orgId)).limit(1);
  const org = orgRows[0];
  if (!org) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_NOT_FOUND);
  }
  if (org.status !== BizOrgStatus.ACTIVE) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_NOT_FOUND);
  }
  const role = await getOrgRoleForUser(userId, orgId);
  if (!role || !WRITABLE_ORG_ROLES.has(role)) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_ORG_MEMBER_FORBIDDEN);
  }
}

/**
 * 读取标品最低 SKU 价。
 *
 * @param productId - 标品 ID
 * @returns 最低价字符串；无 SKU 为 `null`
 */
async function getMinSkuPrice(productId: number): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ price: serviceProductSku.price })
    .from(serviceProductSku)
    .where(eq(serviceProductSku.productId, productId))
    .orderBy(asc(serviceProductSku.price))
    .limit(1);
  return rows[0] ? String(rows[0].price) : null;
}

/**
 * 组装标品详情（含 SKU 与商户名）。
 *
 * @param productId - 标品 ID
 * @returns 详情；不存在为 `null`
 */
export async function getProductDetailById(productId: number): Promise<ServiceProductDetail | null> {
  const db = getDb();
  const rows = await db.select().from(serviceProduct).where(eq(serviceProduct.id, productId)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const orgRows = await db.select({ name: bizOrg.name }).from(bizOrg).where(eq(bizOrg.id, row.orgId)).limit(1);
  const skuRows = await db
    .select()
    .from(serviceProductSku)
    .where(eq(serviceProductSku.productId, productId))
    .orderBy(asc(serviceProductSku.sortOrder), asc(serviceProductSku.id));

  const minPriceNum = skuRows.reduce<number | null>((min, sku) => {
    const price = Number(sku.price);
    if (!Number.isFinite(price)) return min;
    if (min == null || price < min) return price;
    return min;
  }, null);
  const minPrice = minPriceNum == null ? null : minPriceNum.toFixed(2);

  return {
    ...toProductSummary(row, orgRows[0]?.name ?? null, minPrice),
    description: row.description ?? null,
    skus: skuRows.map(toSkuSummary),
  };
}

/**
 * 商户创建标品（默认 draft），须至少 1 个 SKU。
 *
 * @param userId - 操作人
 * @param orgId - 所属商户
 * @param input - 标品与 SKU
 * @returns 新建标品详情
 * @throws {ApiError} 无权或参数非法
 */
export async function createProduct(
  userId: number,
  orgId: number,
  input: ServiceProductInput,
): Promise<ServiceProductDetail> {
  await assertCanManageOrgProducts(userId, orgId);
  const skus = validateProductInput(input);

  const db = getDb();
  const [result] = await db.insert(serviceProduct).values({
    orgId,
    categoryCode: input.categoryCode,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    coverUrl: input.coverUrl?.trim() || null,
    destination: input.destination?.trim() || null,
    status: ProductStatus.DRAFT,
  });
  const productId = Number(result.insertId);

  for (const sku of skus) {
    await db.insert(serviceProductSku).values({
      productId,
      name: sku.name,
      price: sku.price,
      stock: sku.stock,
      sortOrder: sku.sortOrder,
    });
  }

  const detail = await getProductDetailById(productId);
  return detail!;
}

/**
 * 更新标品基础信息与 SKU（全量替换 SKU）。
 *
 * @param productId - 标品 ID
 * @param userId - 操作人
 * @param input - 新内容
 * @returns 更新后详情
 * @throws {ApiError} 不存在、无权或参数非法
 */
export async function updateProduct(
  productId: number,
  userId: number,
  input: ServiceProductInput,
): Promise<ServiceProductDetail> {
  const existing = await getProductDetailById(productId);
  if (!existing) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PRODUCT_NOT_FOUND);
  }
  await assertCanManageOrgProducts(userId, existing.orgId);
  const skus = validateProductInput(input);

  const db = getDb();
  await db
    .update(serviceProduct)
    .set({
      categoryCode: input.categoryCode,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      coverUrl: input.coverUrl?.trim() || null,
      destination: input.destination?.trim() || null,
    })
    .where(eq(serviceProduct.id, productId));

  await db.delete(serviceProductSku).where(eq(serviceProductSku.productId, productId));
  for (const sku of skus) {
    await db.insert(serviceProductSku).values({
      productId,
      name: sku.name,
      price: sku.price,
      stock: sku.stock,
      sortOrder: sku.sortOrder,
    });
  }

  const detail = await getProductDetailById(productId);
  return detail!;
}

/**
 * 上架或下架标品。
 *
 * @param productId - 标品 ID
 * @param userId - 操作人
 * @param status - `on_sale` 或 `off_sale`
 * @returns 更新后详情
 * @throws {ApiError} 状态非法、无权或不存在
 */
export async function setProductStatus(
  productId: number,
  userId: number,
  status: typeof ProductStatus.ON_SALE | typeof ProductStatus.OFF_SALE,
): Promise<ServiceProductDetail> {
  if (status !== ProductStatus.ON_SALE && status !== ProductStatus.OFF_SALE) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PRODUCT_STATUS_INVALID);
  }
  const existing = await getProductDetailById(productId);
  if (!existing) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PRODUCT_NOT_FOUND);
  }
  await assertCanManageOrgProducts(userId, existing.orgId);

  if (status === ProductStatus.ON_SALE && existing.skus.length === 0) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PRODUCT_INVALID);
  }

  const db = getDb();
  await db.update(serviceProduct).set({ status }).where(eq(serviceProduct.id, productId));
  const detail = await getProductDetailById(productId);
  return detail!;
}

/**
 * 列出商户自有标品（含草稿/下架）。
 *
 * @param userId - 操作人
 * @param orgId - 商户 ID
 * @returns 按更新时间倒序；无记录为空数组
 * @throws {ApiError} 无权
 */
export async function listProductsByOrg(userId: number, orgId: number): Promise<ServiceProductSummary[]> {
  await assertCanManageOrgProducts(userId, orgId);
  const db = getDb();
  const rows = await db
    .select()
    .from(serviceProduct)
    .where(eq(serviceProduct.orgId, orgId))
    .orderBy(desc(serviceProduct.updatedAt));

  const orgRows = await db.select({ name: bizOrg.name }).from(bizOrg).where(eq(bizOrg.id, orgId)).limit(1);
  const orgName = orgRows[0]?.name ?? null;

  const result: ServiceProductSummary[] = [];
  for (const row of rows) {
    result.push(toProductSummary(row, orgName, await getMinSkuPrice(row.id)));
  }
  return result;
}

/**
 * 公开标品大厅（仅 `on_sale`）。
 *
 * @param query - 分页与筛选
 * @returns 分页结果
 */
export async function listOnSaleProducts(
  query: ServiceProductHallQuery,
): Promise<PaginatedResult<ServiceProductSummary>> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions = [eq(serviceProduct.status, ProductStatus.ON_SALE)];
  if (query.categoryCode) {
    conditions.push(eq(serviceProduct.categoryCode, query.categoryCode));
  }
  if (query.orgId != null) {
    conditions.push(eq(serviceProduct.orgId, query.orgId));
  }
  if (query.destination?.trim()) {
    conditions.push(like(serviceProduct.destination, `%${query.destination.trim()}%`));
  }
  if (query.keyword?.trim()) {
    const kw = `%${query.keyword.trim()}%`;
    conditions.push(or(like(serviceProduct.title, kw), like(serviceProduct.description, kw))!);
  }

  const db = getDb();
  const whereClause = and(...conditions);
  const [totalRow] = await db.select({ value: count() }).from(serviceProduct).where(whereClause);
  const rows = await db
    .select()
    .from(serviceProduct)
    .where(whereClause)
    .orderBy(desc(serviceProduct.updatedAt))
    .limit(pageSize)
    .offset(offset);

  const items: ServiceProductSummary[] = [];
  for (const row of rows) {
    const orgRows = await db.select({ name: bizOrg.name }).from(bizOrg).where(eq(bizOrg.id, row.orgId)).limit(1);
    items.push(toProductSummary(row, orgRows[0]?.name ?? null, await getMinSkuPrice(row.id)));
  }

  return {
    items,
    total: totalRow?.value ?? 0,
    page,
    pageSize,
  };
}

/**
 * 读取公开标品详情（须上架）；商户成员可读任意状态。
 *
 * @param productId - 标品 ID
 * @param userId - 可选登录用户；成员可看草稿
 * @returns 详情
 * @throws {ApiError} 不存在或未上架且无权
 */
export async function getProductDetailForViewer(
  productId: number,
  userId?: number,
): Promise<ServiceProductDetail> {
  const detail = await getProductDetailById(productId);
  if (!detail) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_PRODUCT_NOT_FOUND);
  }

  if (PUBLIC_PRODUCT_STATUSES.includes(detail.status)) {
    return detail;
  }

  if (userId != null) {
    const role = await getOrgRoleForUser(userId, detail.orgId);
    if (role) return detail;
  }

  throw new ApiError(ApiMessageKey.MARKETPLACE_PRODUCT_NOT_FOUND);
}

/**
 * 按 SKU ID 读取库存行（直购扣减用）。
 *
 * @param skuId - SKU ID
 * @returns SKU 行；不存在为 `null`
 */
export async function getSkuRowById(skuId: number) {
  const db = getDb();
  const rows = await db.select().from(serviceProductSku).where(eq(serviceProductSku.id, skuId)).limit(1);
  return rows[0] ?? null;
}

/**
 * 扣减 SKU 库存（先读后写；库存不足返回 false）。
 *
 * @param skuId - SKU ID
 * @param quantity - 扣减数量；须为正整数
 * @returns 扣减成功为 true
 */
export async function decreaseSkuStock(skuId: number, quantity: number): Promise<boolean> {
  if (!Number.isInteger(quantity) || quantity <= 0) return false;
  const db = getDb();
  const rows = await db
    .select({ id: serviceProductSku.id, stock: serviceProductSku.stock })
    .from(serviceProductSku)
    .where(eq(serviceProductSku.id, skuId))
    .limit(1);
  const row = rows[0];
  if (!row || row.stock < quantity) {
    return false;
  }

  await db
    .update(serviceProductSku)
    .set({ stock: row.stock - quantity })
    .where(and(eq(serviceProductSku.id, skuId), eq(serviceProductSku.stock, row.stock)));

  const after = await db
    .select({ stock: serviceProductSku.stock })
    .from(serviceProductSku)
    .where(eq(serviceProductSku.id, skuId))
    .limit(1);
  return after[0] != null && after[0].stock === row.stock - quantity;
}

/**
 * 增加 SKU 库存（取消直购订单时回补）。
 *
 * @param skuId - SKU ID
 * @param quantity - 增加数量；须为正整数
 * @returns 成功为 true
 */
export async function increaseSkuStock(skuId: number, quantity: number): Promise<boolean> {
  if (!Number.isInteger(quantity) || quantity <= 0) return false;
  const db = getDb();
  const rows = await db
    .select({ id: serviceProductSku.id, stock: serviceProductSku.stock })
    .from(serviceProductSku)
    .where(eq(serviceProductSku.id, skuId))
    .limit(1);
  const row = rows[0];
  if (!row) return false;
  await db
    .update(serviceProductSku)
    .set({ stock: row.stock + quantity })
    .where(eq(serviceProductSku.id, skuId));
  return true;
}
