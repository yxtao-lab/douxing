/**
 * M7 · 商户端 Partner 正式验收（M7-α 子集）
 *
 * 覆盖：入驻 → partner context → 大厅可见 → org 报价 → 选定 → mock 支付 → 卖方履约 → 结算旁证
 * 不覆盖：M7-3 排期、M7-4 履约汇报、Partner 财务 UI、微信真付、独立 packages/partner
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server m7:marketplace-partner-cases
 */
import '../config/env.js';
import { eq, inArray } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  BizOrgStatus,
  BizOrgType,
  DemandStatus,
  OrgDocumentType,
  OrgRole,
  QuoteStatus,
  ServiceOrderStatus,
  SettlementStatus,
  resolveApiMessage,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { bizOrg, orgMember } from '../db/schema/marketplace-biz-org.js';
import { bizOrgDocument } from '../db/schema/marketplace-biz-org-documents.js';
import { demandQuote, serviceDemand } from '../db/schema/marketplace-demand.js';
import { serviceOrder } from '../db/schema/marketplace-order.js';
import { orgSettlement } from '../db/schema/marketplace-settlement.js';
import { marketplaceNotification } from '../db/schema/marketplace-notification.js';
import {
  applyBizOrg,
  getOrgRoleForUser,
  reviewBizOrg,
} from '../services/marketplace/marketplace-org-onboard.service.js';
import { enrollMerchantAdminAccess } from '../services/marketplace/marketplace-merchant-role.service.js';
import { getMarketplacePartnerContext } from '../services/marketplace/marketplace-partner.service.js';
import {
  createDemand,
  listPublishedDemands,
  publishDemand,
} from '../services/marketplace/marketplace-demand.service.js';
import {
  createDemandQuote,
  listPartnerQuotesByUser,
} from '../services/marketplace/marketplace-quote.service.js';
import {
  advanceServiceOrderStatus,
  listServiceOrdersBySeller,
  payMockServiceOrder,
  selectQuoteAndCreateOrder,
} from '../services/marketplace/marketplace-order.service.js';
import { getSettlementByOrderId, listSettlementsByOrg } from '../services/marketplace/marketplace-settlement.service.js';

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
 * 获取或创建 M7 测试用户。
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
    passwordHash: 'm7-test-placeholder',
    nickname: username,
    email: `${username}@m7.test`,
  });
  return Number(result.insertId);
}

/**
 * 级联清理发单人相关需求、报价、订单与匹配通知。
 *
 * @param userId - 发单人用户 ID
 */
async function cleanupPublisherData(userId: number): Promise<void> {
  const db = getDb();
  const demands = await db
    .select({ id: serviceDemand.id })
    .from(serviceDemand)
    .where(eq(serviceDemand.publisherUserId, userId));
  const demandIds = demands.map((row) => row.id);
  if (demandIds.length === 0) return;

  const orders = await db
    .select({ id: serviceOrder.id })
    .from(serviceOrder)
    .where(inArray(serviceOrder.demandId, demandIds));
  const orderIds = orders.map((row) => row.id);
  if (orderIds.length > 0) {
    await db.delete(orgSettlement).where(inArray(orgSettlement.orderId, orderIds));
    await db.delete(serviceOrder).where(inArray(serviceOrder.id, orderIds));
  }
  await db.delete(demandQuote).where(inArray(demandQuote.demandId, demandIds));
  await db
    .delete(marketplaceNotification)
    .where(inArray(marketplaceNotification.refId, demandIds));
  await db.delete(serviceDemand).where(inArray(serviceDemand.id, demandIds));
}

/**
 * 清理商户组织及其成员、资质、结算。
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
    const orders = await db
      .select({ id: serviceOrder.id })
      .from(serviceOrder)
      .where(eq(serviceOrder.sellerOrgId, row.orgId));
    const orderIds = orders.map((item) => item.id);
    if (orderIds.length > 0) {
      await db.delete(orgSettlement).where(inArray(orgSettlement.orderId, orderIds));
      await db.delete(serviceOrder).where(inArray(serviceOrder.id, orderIds));
    }
    await db.delete(orgSettlement).where(eq(orgSettlement.orgId, row.orgId));
    await db.delete(bizOrgDocument).where(eq(bizOrgDocument.orgId, row.orgId));
    await db.delete(orgMember).where(eq(orgMember.orgId, row.orgId));
    await db.delete(bizOrg).where(eq(bizOrg.id, row.orgId));
  }
}

/**
 * 检查 Partner/订单相关 i18n。
 */
function checkI18nKeys() {
  console.log('--- i18n ---');
  const keys = [
    ApiMessageKey.MARKETPLACE_ORG_MEMBER_FORBIDDEN,
    ApiMessageKey.MARKETPLACE_PROVIDER_NOT_APPROVED,
    ApiMessageKey.MARKETPLACE_ORDER_FORBIDDEN,
    ApiMessageKey.MARKETPLACE_DEMAND_NOT_QUOTABLE,
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
 * M7-1/2b：入驻、enroll、partner context。
 *
 * @returns 商户 owner 与 orgId
 */
async function checkOnboardAndContext(): Promise<{ merchantId: number; orgId: number }> {
  console.log('--- M7-1/2b 入驻与 context ---');

  const merchantId = await ensureTestUser('m7_merchant');
  await cleanupOrgData(merchantId);

  const enrolled = await enrollMerchantAdminAccess(merchantId);
  assert(enrolled === true || enrolled === false, 'enrollMerchantAdminAccess 可调用');
  await enrollMerchantAdminAccess(merchantId);
  assert(true, 'enroll 幂等可重复调用');

  const applied = await applyBizOrg(merchantId, {
    name: 'M7 Partner 旅行社',
    orgType: BizOrgType.TRAVEL_AGENCY,
    licenseNo: 'M7-TRAVEL-001',
    contactPhone: '13800000077',
    documents: [
      {
        docType: OrgDocumentType.LICENSE,
        fileUrl: '/uploads/marketplace/test/m7-license.pdf',
        fileName: 'license.pdf',
      },
    ],
  });

  const reviewerRows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, 'admin'))
    .limit(1);
  const reviewerId = reviewerRows[0]?.id ?? merchantId;
  const approved = await reviewBizOrg(applied.id, reviewerId, { action: 'approve' });
  assert(approved.status === BizOrgStatus.ACTIVE, '商户审核通过');
  assert((await getOrgRoleForUser(merchantId, approved.id)) === OrgRole.OWNER, 'owner 角色');

  const context = await getMarketplacePartnerContext(merchantId);
  assert(context.quotableOrgIds.includes(approved.id), 'context.quotableOrgIds 含本商户');
  assert(
    context.memberships.some((item) => item.orgId === approved.id),
    'context.memberships 含本商户',
  );

  console.log('');
  return { merchantId, orgId: approved.id };
}

/**
 * M7-2/2c：大厅报价 → 成单 → 卖方履约 → 结算旁证。
 *
 * @param merchant - 已入驻商户
 */
async function checkPartnerFullOrder(merchant: { merchantId: number; orgId: number }) {
  console.log('--- M7-2/2c 接单履约闭环 ---');

  const publisherId = await ensureTestUser('m7_publisher');
  await cleanupPublisherData(publisherId);
  const strangerId = await ensureTestUser('m7_stranger');

  const draft = await createDemand(publisherId, {
    categoryCode: 'travel.custom_tour',
    title: 'M7 Partner 杭州定制游',
    description: 'Partner 验收发单',
    destination: '杭州',
    budgetMin: '5000',
    budgetMax: '12000',
    budgetType: 'range',
  });
  const published = await publishDemand(draft.id, publisherId);
  assert(published.status === DemandStatus.PUBLISHED, '需求已发布');

  const hall = await listPublishedDemands({ page: 1, pageSize: 30, destination: '杭州' });
  assert(hall.items.some((item) => item.id === draft.id), '接单大厅可见需求');

  let strangerBlocked = false;
  try {
    await createDemandQuote(draft.id, strangerId, {
      amount: '8000.00',
      proposalText: '非成员代 org 报价应失败',
      orgId: merchant.orgId,
    });
  } catch (err) {
    strangerBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_ORG_MEMBER_FORBIDDEN;
  }
  assert(strangerBlocked, '非成员不可代 org 报价');

  const quote = await createDemandQuote(draft.id, merchant.merchantId, {
    amount: '8800.00',
    proposalText: '含住宿与向导，Partner 自助报价',
    orgId: merchant.orgId,
  });
  assert(quote.status === QuoteStatus.PENDING, '商户报价成功');
  assert(quote.orgId === merchant.orgId, '报价绑定 orgId');

  const partnerQuotes = await listPartnerQuotesByUser(merchant.merchantId);
  assert(
    partnerQuotes.some((item) => item.id === quote.id && item.demandTitle != null),
    '我的报价列表可见',
  );

  const order = await selectQuoteAndCreateOrder(draft.id, publisherId, { quoteId: quote.id });
  assert(order.status === ServiceOrderStatus.PENDING_PAY, '选定后 pending_pay');
  assert(order.sellerOrgId === merchant.orgId, '卖方为商户');

  const paid = await payMockServiceOrder(order.id, publisherId);
  assert(paid.status === ServiceOrderStatus.PAID, 'mock 支付成功');

  const sellerOrders = await listServiceOrdersBySeller(merchant.merchantId);
  assert(sellerOrders.some((item) => item.id === order.id), '卖方订单列表可见');

  await advanceServiceOrderStatus(order.id, merchant.merchantId, {
    status: ServiceOrderStatus.IN_PROGRESS,
  });
  await advanceServiceOrderStatus(order.id, merchant.merchantId, {
    status: ServiceOrderStatus.DELIVERED,
  });
  const confirmed = await advanceServiceOrderStatus(order.id, merchant.merchantId, {
    status: ServiceOrderStatus.CONFIRMED,
  });
  assert(confirmed.status === ServiceOrderStatus.CONFIRMED, '卖方推进至 confirmed');

  const demandRows = await getDb()
    .select({ status: serviceDemand.status })
    .from(serviceDemand)
    .where(eq(serviceDemand.id, draft.id))
    .limit(1);
  assert(demandRows[0]?.status === DemandStatus.COMPLETED, '需求 status=completed');

  const settlement = await getSettlementByOrderId(order.id);
  assert(settlement != null, 'confirmed 后生成结算台账（M6 旁证）');
  assert(settlement!.status === SettlementStatus.PENDING, '台账 pending');
  assert(settlement!.orgId === merchant.orgId, '台账归属本商户');

  const settlements = await listSettlementsByOrg(merchant.orgId);
  assert(settlements.some((item) => item.orderId === order.id), '商户结算列表可读（财务 API 基础）');

  console.log('');
}

/**
 * 入口：M7-α 子集验收。
 */
async function main() {
  console.log('=== M7 marketplace partner cases (α 子集) ===\n');
  console.log('[info] 不覆盖 M7-3 排期 / M7-4 汇报 / Partner 财务 UI / 微信真付\n');

  checkI18nKeys();
  const merchant = await checkOnboardAndContext();
  await checkPartnerFullOrder(merchant);

  if (failed > 0) {
    console.error(`\nM7-α 验收失败：${failed} 项`);
    process.exit(1);
  }
  console.log('\nM7-α 子集验收全部通过（服务方自助一单 · MB4 完整达成仍待 E2 + M7-3～5）');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
