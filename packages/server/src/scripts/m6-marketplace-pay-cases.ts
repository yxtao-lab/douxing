/**
 * M6 · 支付与分佣验收（含 E2 预下单/履约接线；沙箱真机一笔待商户号）
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server m6:marketplace-pay-cases
 *
 * 说明：沙箱「真实微信支付一笔」依赖公司主体 + 商户号；本脚本验收 mock 支付、预下单
 * 渠道解析、履约幂等、抽佣/台账/取消。
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
  PaymentChannel,
  ProductStatus,
  ServiceOrderStatus,
  SettlementStatus,
  resolveApiMessage,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { bizOrg, orgMember } from '../db/schema/marketplace-biz-org.js';
import { bizOrgDocument } from '../db/schema/marketplace-biz-org-documents.js';
import { serviceOrder } from '../db/schema/marketplace-order.js';
import { serviceProduct, serviceProductSku } from '../db/schema/marketplace-product.js';
import { orgSettlement } from '../db/schema/marketplace-settlement.js';
import {
  applyBizOrg,
  getOrgRoleForUser,
  reviewBizOrg,
  updateOrgSettlementConfig,
} from '../services/marketplace/marketplace-org-onboard.service.js';
import {
  createProduct,
  getProductDetailById,
  setProductStatus,
} from '../services/marketplace/marketplace-product.service.js';
import {
  advanceServiceOrderStatus,
  calcPlatformFee,
  cancelServiceOrder,
  createOrderFromProduct,
  createServiceOrderPrepay,
  fulfillServiceOrderAfterPaid,
  getServiceOrderByOrderNo,
  payMockServiceOrder,
  requestServiceOrderPay,
  requestServiceOrderRefundPlaceholder,
  resolvePlatformFeeRate,
} from '../services/marketplace/marketplace-order.service.js';
import {
  getSettlementByOrderId,
  listSettlementsByOrg,
} from '../services/marketplace/marketplace-settlement.service.js';
import { getPaymentMode, isWechatPayConfigured } from '../config/payment.js';

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
 * 获取或创建 M6 测试用户。
 *
 * @param username - 用户名
 * @returns 用户 ID
 */
async function ensureTestUser(username: string): Promise<number> {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (rows[0]) return rows[0].id;
  const [result] = await db.insert(users).values({
    username,
    passwordHash: 'm6-test-placeholder',
    nickname: username,
    email: `${username}@m6.test`,
  });
  return Number(result.insertId);
}

/**
 * 清理商户、标品、订单与结算台账。
 *
 * @param userId - 商户 owner
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
      const orders = await db
        .select({ id: serviceOrder.id })
        .from(serviceOrder)
        .where(inArray(serviceOrder.productId, productIds));
      const orderIds = orders.map((item) => item.id);
      if (orderIds.length > 0) {
        await db.delete(orgSettlement).where(inArray(orgSettlement.orderId, orderIds));
        await db.delete(serviceOrder).where(inArray(serviceOrder.id, orderIds));
      }
      await db.delete(serviceProductSku).where(inArray(serviceProductSku.productId, productIds));
      await db.delete(serviceProduct).where(inArray(serviceProduct.id, productIds));
    }
    await db.delete(orgSettlement).where(eq(orgSettlement.orgId, row.orgId));
    await db.delete(bizOrgDocument).where(eq(bizOrgDocument.orgId, row.orgId));
    await db.delete(orgMember).where(eq(orgMember.orgId, row.orgId));
    await db.delete(bizOrg).where(eq(bizOrg.id, row.orgId));
  }
}

/**
 * 确保已审核商户。
 *
 * @returns owner 与 orgId
 */
async function ensureApprovedOrg(): Promise<{ userId: number; orgId: number }> {
  const userId = await ensureTestUser('m6_merchant');
  await cleanupOrgData(userId);

  const applied = await applyBizOrg(userId, {
    name: 'M6 分佣旅行社',
    orgType: BizOrgType.TRAVEL_AGENCY,
    licenseNo: 'M6-TRAVEL-001',
    contactPhone: '13800000066',
    documents: [
      {
        docType: OrgDocumentType.LICENSE,
        fileUrl: '/uploads/marketplace/test/m6-license.pdf',
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
  assert((await getOrgRoleForUser(userId, approved.id)) === OrgRole.OWNER, '商户 owner');
  return { userId, orgId: approved.id };
}

/**
 * 检查 M6 i18n 键。
 */
function checkI18nKeys() {
  console.log('--- i18n ---');
  const keys = [
    ApiMessageKey.MARKETPLACE_ORDER_CANCEL_INVALID,
    ApiMessageKey.MARKETPLACE_ORDER_REFUND_INVALID,
    ApiMessageKey.MARKETPLACE_REFUND_PLACEHOLDER,
    ApiMessageKey.MARKETPLACE_PAYMENT_WECHAT_UNAVAILABLE,
    ApiMessageKey.MARKETPLACE_SETTLEMENT_CONFIG_INVALID,
    ApiMessageKey.WECHAT_PAY_MP_ONLY,
    ApiMessageKey.WECHAT_PAY_NOT_CONFIGURED,
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
 * M6-2：可配抽佣费率写入订单快照。
 *
 * @returns 含待支付订单的上下文
 */
async function checkPlatformFee() {
  console.log('--- M6-2 平台抽佣 ---');
  const { userId, orgId } = await ensureApprovedOrg();

  await updateOrgSettlementConfig(orgId, null, { platformFeeRate: 0.1 });
  const rate = await resolvePlatformFeeRate(orgId);
  assert(rate === 0.1, '读取 settlement_config.platformFeeRate=0.1');
  assert(calcPlatformFee('1000.00', 0.1) === '100.00', '抽佣计算 10%');

  const product = await createProduct(userId, orgId, {
    categoryCode: 'travel.custom_tour',
    title: 'M6 抽佣套餐',
    destination: '杭州',
    skus: [{ name: '标准', price: '1000.00', stock: 5 }],
  });
  await setProductStatus(product.id, userId, ProductStatus.ON_SALE);

  const buyerId = await ensureTestUser('m6_buyer');
  const order = await createOrderFromProduct(product.id, buyerId, {
    skuId: product.skus[0]!.id,
    quantity: 1,
  });
  assert(order.platformFee === '100.00', '成单 platform_fee 快照=100');
  assert(order.totalAmount === '1000.00', '成单金额 1000');

  console.log('');
  return { userId, orgId, productId: product.id, skuId: product.skus[0]!.id, buyerId, orderId: order.id };
}

/**
 * M6-1 / E2：预下单渠道、履约幂等、统一支付入口。
 *
 * @param ctx - 含待支付订单上下文
 */
async function checkPayAndCancel(ctx: {
  userId: number;
  orgId: number;
  productId: number;
  skuId: number;
  buyerId: number;
  orderId: number;
}) {
  console.log('--- M6-1/E2 支付与取消 ---');

  const mode = getPaymentMode();
  assert(mode === 'mock' || mode === 'auto' || mode === 'wechat', `支付模式可读: ${mode}`);

  const prepayPending = await createServiceOrderPrepay(ctx.orderId, ctx.buyerId);
  if (mode === 'wechat') {
    assert('error' in prepayPending, 'wechat 模式无 wxCode → 预下单失败');
    if ('error' in prepayPending) {
      assert(
        prepayPending.error === ApiMessageKey.WECHAT_PAY_MP_ONLY ||
          prepayPending.error === ApiMessageKey.WECHAT_PAY_NOT_CONFIGURED,
        `无 wxCode 错误可识别: ${prepayPending.error}`,
      );
    }
  } else {
    assert(!('error' in prepayPending), '预下单成功（mock/auto）');
    if (!('error' in prepayPending)) {
      assert(prepayPending.prepay.channel === PaymentChannel.MOCK, '预下单 channel=mock');
      assert(prepayPending.prepay.orderId === ctx.orderId, '预下单 orderId 一致');
    }
  }

  const paid = await requestServiceOrderPay(ctx.orderId, ctx.buyerId);
  assert(paid.status === ServiceOrderStatus.PAID, 'requestServiceOrderPay → paid');

  const idempotent = await fulfillServiceOrderAfterPaid(ctx.orderId);
  assert(!('error' in idempotent), 'fulfillServiceOrderAfterPaid 幂等');

  const found = await getServiceOrderByOrderNo(paid.orderNo);
  assert(found != null && found.id === ctx.orderId, 'getServiceOrderByOrderNo 可路由回调');

  const cancelOrder = await createOrderFromProduct(ctx.productId, ctx.buyerId, {
    skuId: ctx.skuId,
    quantity: 1,
  });
  const before = await getProductDetailById(ctx.productId);
  const stockBefore = before!.skus.find((s) => s.id === ctx.skuId)!.stock;

  const cancelled = await cancelServiceOrder(cancelOrder.id, ctx.buyerId);
  assert(cancelled.status === ServiceOrderStatus.CANCELLED, '待支付可取消');

  const after = await getProductDetailById(ctx.productId);
  const stockAfter = after!.skus.find((s) => s.id === ctx.skuId)!.stock;
  assert(stockAfter === stockBefore + 1, '取消直购回补库存');

  let cancelBlocked = false;
  try {
    await cancelServiceOrder(ctx.orderId, ctx.buyerId);
  } catch (err) {
    cancelBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_ORDER_CANCEL_INVALID;
  }
  assert(cancelBlocked, '已支付不可取消');

  const refund = await requestServiceOrderRefundPlaceholder(ctx.orderId, ctx.buyerId);
  assert(refund.status === 'refund_pending', '退款占位 status');
  assert(refund.messageKey === ApiMessageKey.MARKETPLACE_REFUND_PLACEHOLDER, '退款占位 messageKey');

  console.log('');
}

/**
 * M6-3：confirmed 后生成结算台账。
 *
 * @param ctx - 商户与买方
 */
async function checkSettlement(ctx: {
  userId: number;
  orgId: number;
  productId: number;
  skuId: number;
  buyerId: number;
}) {
  console.log('--- M6-3 结算台账 ---');

  const order = await createOrderFromProduct(ctx.productId, ctx.buyerId, {
    skuId: ctx.skuId,
    quantity: 1,
  });
  await payMockServiceOrder(order.id, ctx.buyerId);
  await advanceServiceOrderStatus(order.id, ctx.buyerId, { status: ServiceOrderStatus.IN_PROGRESS });
  await advanceServiceOrderStatus(order.id, ctx.buyerId, { status: ServiceOrderStatus.DELIVERED });
  await advanceServiceOrderStatus(order.id, ctx.buyerId, { status: ServiceOrderStatus.CONFIRMED });

  const settlement = await getSettlementByOrderId(order.id);
  assert(settlement != null, 'confirmed 后生成结算台账');
  assert(settlement!.status === SettlementStatus.PENDING, '台账 status=pending');
  assert(settlement!.orgId === ctx.orgId, '台账绑定商户');
  assert(settlement!.grossAmount === order.totalAmount, 'gross=订单金额');
  assert(settlement!.platformFee === order.platformFee, 'fee=订单抽佣快照');
  assert(
    settlement!.netAmount ===
      (Number(order.totalAmount) - Number(order.platformFee)).toFixed(2),
    'net=gross-fee',
  );

  const list = await listSettlementsByOrg(ctx.orgId);
  assert(list.some((item) => item.orderId === order.id), '商户结算列表可见');

  const again = await getSettlementByOrderId(order.id);
  assert(again!.id === settlement!.id, '结算台账幂等不重复');

  console.log('');
}

/**
 * 入口。
 */
async function main() {
  console.log('=== M6 marketplace pay cases (E2 wiring) ===\n');
  console.log(
    `[info] PAYMENT_MODE=${getPaymentMode()} · wechatConfigured=${isWechatPayConfigured()} · 沙箱真机一笔待商户号\n`,
  );

  checkI18nKeys();
  const feeCtx = await checkPlatformFee();
  await checkPayAndCancel(feeCtx);
  await checkSettlement(feeCtx);

  if (failed > 0) {
    console.error(`\nM6 验收失败：${failed} 项`);
    process.exit(1);
  }
  console.log('\nM6/E2 通道接线验收全部通过（沙箱真机一笔待商户号）');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
