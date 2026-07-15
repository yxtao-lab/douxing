/**
 * M5 · 发单接单标品上架验收（M5-1～M5-5）
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server m5:marketplace-product-cases
 */
import '../config/env.js';
import { eq, inArray } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  BizOrgStatus,
  BizOrgType,
  OrgDocumentType,
  OrgRole,
  ProductStatus,
  ServiceOrderStatus,
  resolveApiMessage,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { bizOrg, orgMember } from '../db/schema/marketplace-biz-org.js';
import { bizOrgDocument } from '../db/schema/marketplace-biz-org-documents.js';
import { serviceOrder } from '../db/schema/marketplace-order.js';
import { serviceProduct, serviceProductSku } from '../db/schema/marketplace-product.js';
import {
  applyBizOrg,
  getOrgRoleForUser,
  reviewBizOrg,
} from '../services/marketplace/marketplace-org-onboard.service.js';
import {
  createProduct,
  getProductDetailById,
  listOnSaleProducts,
  listProductsByOrg,
  setProductStatus,
} from '../services/marketplace/marketplace-product.service.js';
import {
  createOrderFromProduct,
  payMockServiceOrder,
} from '../services/marketplace/marketplace-order.service.js';

let failed = 0;

/**
 * 断言条件为真，失败时累计失败计数并打印标签。
 *
 * @param condition - 期望为真的条件
 * @param label - 用例描述
 */
function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

/**
 * 获取或创建 M5 测试专用用户。
 *
 * @param username - 测试用户名
 * @returns 用户 ID
 */
async function ensureTestUser(username: string): Promise<number> {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (rows[0]) return rows[0].id;

  const [result] = await db.insert(users).values({
    username,
    passwordHash: 'm5-test-placeholder',
    nickname: username,
    email: `${username}@m5.test`,
  });
  return Number(result.insertId);
}

/**
 * 清理商户及其标品、直购订单。
 *
 * @param userId - 商户 owner 用户 ID
 */
async function cleanupOrgData(userId: number): Promise<void> {
  const db = getDb();
  const memberships = await db
    .select({ orgId: orgMember.orgId })
    .from(orgMember)
    .where(eq(orgMember.userId, userId));

  for (const row of memberships) {
    const products = await db
      .select({ id: serviceProduct.id })
      .from(serviceProduct)
      .where(eq(serviceProduct.orgId, row.orgId));
    const productIds = products.map((item) => item.id);
    if (productIds.length > 0) {
      await db.delete(serviceOrder).where(inArray(serviceOrder.productId, productIds));
      await db.delete(serviceProductSku).where(inArray(serviceProductSku.productId, productIds));
      await db.delete(serviceProduct).where(inArray(serviceProduct.id, productIds));
    }
    await db.delete(bizOrgDocument).where(eq(bizOrgDocument.orgId, row.orgId));
    await db.delete(orgMember).where(eq(orgMember.orgId, row.orgId));
    await db.delete(bizOrg).where(eq(bizOrg.id, row.orgId));
  }
}

/**
 * 清理买方直购订单。
 *
 * @param userId - 买方用户 ID
 */
async function cleanupBuyerOrders(userId: number): Promise<void> {
  const db = getDb();
  await db.delete(serviceOrder).where(eq(serviceOrder.buyerUserId, userId));
}

/**
 * 确保存在已审核通过的旅行社商户。
 *
 * @returns owner 用户 ID 与 orgId
 */
async function ensureApprovedOrg(): Promise<{ userId: number; orgId: number }> {
  const userId = await ensureTestUser('m5_merchant');
  await cleanupOrgData(userId);

  const applied = await applyBizOrg(userId, {
    name: 'M5 标品旅行社',
    orgType: BizOrgType.TRAVEL_AGENCY,
    licenseNo: 'M5-TRAVEL-001',
    contactPhone: '13800000055',
    documents: [
      {
        docType: OrgDocumentType.LICENSE,
        fileUrl: '/uploads/marketplace/test/m5-license.pdf',
        fileName: 'license.pdf',
      },
    ],
  });

  const reviewerRows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, 'admin'))
    .limit(1);
  const reviewerId = reviewerRows[0]?.id ?? userId;
  const approved = await reviewBizOrg(applied.id, reviewerId, { action: 'approve' });
  assert(approved.status === BizOrgStatus.ACTIVE, '商户审核通过');
  assert((await getOrgRoleForUser(userId, approved.id)) === OrgRole.OWNER, '商户 owner 角色');
  return { userId, orgId: approved.id };
}

/**
 * 检查 M5 新增 i18n 键。
 */
function checkI18nKeys() {
  console.log('--- i18n ---');
  const keys = [
    ApiMessageKey.MARKETPLACE_PRODUCT_NOT_FOUND,
    ApiMessageKey.MARKETPLACE_PRODUCT_INVALID,
    ApiMessageKey.MARKETPLACE_PRODUCT_STATUS_INVALID,
    ApiMessageKey.MARKETPLACE_PRODUCT_NOT_ON_SALE,
    ApiMessageKey.MARKETPLACE_PRODUCT_SKU_NOT_FOUND,
    ApiMessageKey.MARKETPLACE_PRODUCT_OUT_OF_STOCK,
    ApiMessageKey.MARKETPLACE_PRODUCT_PURCHASE_INVALID,
  ] as const;

  for (const key of keys) {
    const zh = resolveApiMessage(key, 'zh-CN');
    const en = resolveApiMessage(key, 'en-US');
    assert(zh.length > 0 && zh !== key, `zh-CN ${key}`);
    assert(en.length > 0 && en !== key, `en-US ${key}`);
  }
  console.log('');
}

/**
 * M5-1/M5-2：标品 CRUD 与上下架。
 */
async function checkProductCrud() {
  console.log('--- M5-1/2 标品 CRUD ---');

  const { userId, orgId } = await ensureApprovedOrg();
  const strangerId = await ensureTestUser('m5_stranger');

  const created = await createProduct(userId, orgId, {
    categoryCode: 'travel.custom_tour',
    title: 'M5 西湖半日游套餐',
    description: '含讲解与门票',
    destination: '杭州',
    skus: [
      { name: '标准团', price: '299.00', stock: 10 },
      { name: '私家团', price: '899.00', stock: 3 },
    ],
  });

  assert(created.status === ProductStatus.DRAFT, '创建后默认 draft');
  assert(created.orgId === orgId, '绑定 biz_org');
  assert(created.skus.length === 2, '写入 2 个 SKU');
  assert(created.minPrice === '299.00', '最低价为 299');

  let strangerBlocked = false;
  try {
    await createProduct(strangerId, orgId, {
      categoryCode: 'travel.custom_tour',
      title: '无权创建',
      skus: [{ name: 'A', price: '100.00', stock: 1 }],
    });
  } catch (err) {
    strangerBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_ORG_MEMBER_FORBIDDEN;
  }
  assert(strangerBlocked, '非成员不可创建标品');

  let badCategoryBlocked = false;
  try {
    await createProduct(userId, orgId, {
      categoryCode: 'not.a.category',
      title: '非法类目',
      skus: [{ name: 'A', price: '100.00', stock: 1 }],
    });
  } catch (err) {
    badCategoryBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_CATEGORY_INVALID;
  }
  assert(badCategoryBlocked, '非法类目拒绝');

  const hallBefore = await listOnSaleProducts({ page: 1, pageSize: 50 });
  assert(!hallBefore.items.some((item) => item.id === created.id), '草稿不出现在公开大厅');

  const onSale = await setProductStatus(created.id, userId, ProductStatus.ON_SALE);
  assert(onSale.status === ProductStatus.ON_SALE, '上架成功');

  const hallAfter = await listOnSaleProducts({ page: 1, pageSize: 50, destination: '杭州' });
  assert(hallAfter.items.some((item) => item.id === created.id), '上架后大厅可见');

  const mine = await listProductsByOrg(userId, orgId);
  assert(mine.some((item) => item.id === created.id), '商户我的标品可见');

  const offSale = await setProductStatus(created.id, userId, ProductStatus.OFF_SALE);
  assert(offSale.status === ProductStatus.OFF_SALE, '下架成功');
  const hallOff = await listOnSaleProducts({ page: 1, pageSize: 50 });
  assert(!hallOff.items.some((item) => item.id === created.id), '下架后大厅不可见');

  await setProductStatus(created.id, userId, ProductStatus.ON_SALE);
  console.log('');
  return { userId, orgId, productId: created.id };
}

/**
 * M5-4/M5-5：直购一单 + 模拟支付 + 库存扣减。
 *
 * @param orgCtx - 已上架标品上下文
 */
async function checkDirectPurchase(orgCtx: { userId: number; orgId: number; productId: number }) {
  console.log('--- M5-4/5 直购下单 ---');

  const buyerId = await ensureTestUser('m5_buyer');
  await cleanupBuyerOrders(buyerId);

  const product = await getProductDetailById(orgCtx.productId);
  assert(product != null && product.status === ProductStatus.ON_SALE, '标品可购');
  const sku = product!.skus.find((item) => item.name === '标准团');
  assert(sku != null, '找到标准团 SKU');
  const stockBefore = sku!.stock;

  const order = await createOrderFromProduct(orgCtx.productId, buyerId, {
    skuId: sku!.id,
    quantity: 2,
  });

  assert(order.status === ServiceOrderStatus.PENDING_PAY, '直购订单 pending_pay');
  assert(order.productId === orgCtx.productId, '订单写入 productId');
  assert(order.skuId === sku!.id, '订单写入 skuId');
  assert(order.demandId == null, '直购无 demandId');
  assert(order.quoteId == null, '直购无 quoteId');
  assert(order.productTitle === 'M5 西湖半日游套餐', '订单带标品标题');
  assert(order.totalAmount === '598.00', '金额 = 单价 × 数量');
  assert(order.sellerOrgId === orgCtx.orgId, '卖方为商户');

  const afterCreate = await getProductDetailById(orgCtx.productId);
  const skuAfter = afterCreate!.skus.find((item) => item.id === sku!.id);
  assert(skuAfter!.stock === stockBefore - 2, '下单扣减库存');

  let outOfStockBlocked = false;
  try {
    await createOrderFromProduct(orgCtx.productId, buyerId, {
      skuId: sku!.id,
      quantity: skuAfter!.stock + 1,
    });
  } catch (err) {
    outOfStockBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_PRODUCT_OUT_OF_STOCK;
  }
  assert(outOfStockBlocked, '库存不足拒绝');

  await setProductStatus(orgCtx.productId, orgCtx.userId, ProductStatus.OFF_SALE);
  let notOnSaleBlocked = false;
  try {
    await createOrderFromProduct(orgCtx.productId, buyerId, { skuId: sku!.id, quantity: 1 });
  } catch (err) {
    notOnSaleBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_PRODUCT_NOT_ON_SALE;
  }
  assert(notOnSaleBlocked, '下架后不可购');
  await setProductStatus(orgCtx.productId, orgCtx.userId, ProductStatus.ON_SALE);

  const paid = await payMockServiceOrder(order.id, buyerId);
  assert(paid.status === ServiceOrderStatus.PAID, '模拟支付成功');
  assert(paid.demandId == null, '支付不误写 demand');

  console.log('');
}

/**
 * 入口：顺序执行 M5 验收用例。
 */
async function main() {
  console.log('=== M5 marketplace product cases ===\n');
  checkI18nKeys();
  const orgCtx = await checkProductCrud();
  await checkDirectPurchase(orgCtx);

  if (failed > 0) {
    console.error(`\nM5 验收失败：${failed} 项`);
    process.exit(1);
  }
  console.log('\nM5 验收全部通过');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
