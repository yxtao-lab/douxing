/**
 * M-TRUST-01 · 模块 B 履约评价与争议处理验收
 *
 * 覆盖：双向评价、评价回复、买方争议、平台仲裁、信用分扣减、管理端列表
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server m7-ext:marketplace-trust-cases
 */
import '../config/env.js';
import { eq } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  BizOrgStatus,
  BizOrgType,
  DemandStatus,
  OrgDocumentType,
  OrgRole,
  ProviderType,
  QuoteStatus,
  ServiceOrderDisputeStatus,
  ServiceOrderDisputeType,
  ServiceOrderReviewTargetType,
  ServiceOrderStatus,
  resolveApiMessage,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { bizOrg, orgMember } from '../db/schema/marketplace-biz-org.js';
import { bizOrgDocument } from '../db/schema/marketplace-biz-org-documents.js';
import { demandQuote, serviceDemand } from '../db/schema/marketplace-demand.js';
import { serviceOrder } from '../db/schema/marketplace-order.js';
import { serviceProvider } from '../db/schema/marketplace-provider.js';
import { serviceOrderReview } from '../db/schema/marketplace-review.js';
import { serviceOrderDispute } from '../db/schema/marketplace-dispute.js';
import { applyBizOrg, reviewBizOrg } from '../services/marketplace/marketplace-org-onboard.service.js';
import {
  applyServiceProvider,
  reviewServiceProvider,
} from '../services/marketplace/marketplace-provider.service.js';
import { createDemand, publishDemand } from '../services/marketplace/marketplace-demand.service.js';
import { createDemandQuote } from '../services/marketplace/marketplace-quote.service.js';
import {
  advanceServiceOrderStatus,
  payMockServiceOrder,
  selectQuoteAndCreateOrder,
} from '../services/marketplace/marketplace-order.service.js';
import {
  createServiceOrderReview,
  listServiceOrderReviews,
  replyToServiceOrderReview,
} from '../services/marketplace/marketplace-review.service.js';
import {
  createServiceOrderDispute,
  listServiceOrderDisputes,
  listServiceOrderDisputesForAdmin,
  resolveServiceOrderDispute,
} from '../services/marketplace/marketplace-dispute.service.js';
import { getProviderCreditScore } from '../services/marketplace/marketplace-credit.service.js';

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
 * 获取或创建测试用户。
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
    passwordHash: 'm7-trust-test-placeholder',
    nickname: username,
    email: `${username}@m7-trust.test`,
  });
  return Number(result.insertId);
}

/**
 * 级联清理发单人相关需求、报价、订单（评价/争议随订单级联删除）。
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
    .where(eq(serviceOrder.demandId, demandIds[0]));
  // 扩展：如果需求多单，应使用 inArray；本验收每用户仅一个需求
  const orderIds = orders.map((row) => row.id);
  if (orderIds.length > 0) {
    await db.delete(serviceOrder).where(eq(serviceOrder.id, orderIds[0]));
  }
  await db.delete(demandQuote).where(eq(demandQuote.demandId, demandIds[0]));
  await db.delete(serviceDemand).where(eq(serviceDemand.id, demandIds[0]));
}

/**
 * 清理服务者档案与商户组织。
 *
 * @param userId - 服务者用户 ID
 */
async function cleanupProviderData(userId: number): Promise<void> {
  const db = getDb();
  const providerRows = await db
    .select({ id: serviceProvider.id })
    .from(serviceProvider)
    .where(eq(serviceProvider.userId, userId))
    .limit(1);
  if (providerRows[0]) {
    await db.delete(serviceProvider).where(eq(serviceProvider.id, providerRows[0].id));
  }

  const memberships = await db
    .select({ orgId: orgMember.orgId })
    .from(orgMember)
    .where(eq(orgMember.userId, userId));
  for (const row of memberships) {
    await db.delete(orgMember).where(eq(orgMember.orgId, row.orgId));
    await db.delete(bizOrgDocument).where(eq(bizOrgDocument.orgId, row.orgId));
    await db.delete(bizOrg).where(eq(bizOrg.id, row.orgId));
  }
}

/**
 * 检查评价与争议相关 i18n 文案。
 */
function checkI18nKeys() {
  console.log('--- i18n ---');
  const keys = [
    ApiMessageKey.MARKETPLACE_REVIEW_INVALID,
    ApiMessageKey.MARKETPLACE_REVIEW_FORBIDDEN,
    ApiMessageKey.MARKETPLACE_REVIEW_ALREADY_EXISTS,
    ApiMessageKey.MARKETPLACE_REVIEW_REPLY_FORBIDDEN,
    ApiMessageKey.MARKETPLACE_DISPUTE_INVALID,
    ApiMessageKey.MARKETPLACE_DISPUTE_FORBIDDEN,
    ApiMessageKey.MARKETPLACE_DISPUTE_ALREADY_EXISTS,
    ApiMessageKey.MARKETPLACE_DISPUTE_STATUS_INVALID,
    ApiMessageKey.MARKETPLACE_DISPUTE_RESOLVE_FORBIDDEN,
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
 * 准备已入驻个人服务者与买方，并发单、报价、成单、履约至 confirmed。
 *
 * @returns 订单 ID、买方 ID、服务方 ID
 */
async function prepareConfirmedOrder(): Promise<{ orderId: number; buyerId: number; sellerId: number }> {
  console.log('--- 准备 confirmed 订单 ---');

  const buyerId = await ensureTestUser('m7_trust_buyer');
  await cleanupPublisherData(buyerId);
  const sellerId = await ensureTestUser('m7_trust_seller');
  await cleanupProviderData(sellerId);
  const strangerId = await ensureTestUser('m7_trust_stranger');

  // 个人服务者认证
  const provider = await applyServiceProvider(sellerId, {
    providerType: ProviderType.GUIDE,
    categoryCodes: ['travel.guide'],
    serviceRegions: ['杭州'],
    displayName: 'M7 信任向导',
    bio: '信任验收向导',
  });
  const db = getDb();
  const reviewerRows = await db.select({ id: users.id }).from(users).where(eq(users.username, 'admin')).limit(1);
  const reviewerId = reviewerRows[0]?.id ?? sellerId;
  await reviewServiceProvider(provider.id, reviewerId, { action: 'approve' });
  const creditBefore = await getProviderCreditScore(sellerId);
  assert(creditBefore != null, '服务者信用分初始可读');

  // 发单
  const draft = await createDemand(buyerId, {
    categoryCode: 'travel.custom_tour',
    title: 'M7 信任验收杭州定制游',
    description: '评价与争议验收',
    destination: '杭州',
    budgetMin: '3000',
    budgetMax: '8000',
    budgetType: 'range',
  });
  const published = await publishDemand(draft.id, buyerId);
  assert(published.status === DemandStatus.PUBLISHED, '需求已发布');

  // 报价并成单
  const quote = await createDemandQuote(draft.id, sellerId, {
    amount: '5000.00',
    proposalText: '信任验收报价',
  });
  assert(quote.status === QuoteStatus.PENDING, '报价成功');

  const order = await selectQuoteAndCreateOrder(draft.id, buyerId, { quoteId: quote.id });
  assert(order.status === ServiceOrderStatus.PENDING_PAY, '订单 pending_pay');
  assert(order.sellerProviderUserId === sellerId, '卖方为个人服务者');

  await payMockServiceOrder(order.id, buyerId);
  await advanceServiceOrderStatus(order.id, sellerId, { status: ServiceOrderStatus.IN_PROGRESS });
  await advanceServiceOrderStatus(order.id, sellerId, { status: ServiceOrderStatus.DELIVERED });
  const confirmed = await advanceServiceOrderStatus(order.id, sellerId, { status: ServiceOrderStatus.CONFIRMED });
  assert(confirmed.status === ServiceOrderStatus.CONFIRMED, '订单 confirmed');

  console.log('');
  return { orderId: order.id, buyerId, sellerId };
}

/**
 * 验证双向评价流程。
 *
 * @param orderId - 订单 ID
 * @param buyerId - 买方 ID
 * @param sellerId - 卖方 ID
 */
async function checkReviews(orderId: number, buyerId: number, sellerId: number) {
  console.log('--- 履约评价 ---');

  // 买方评价卖方
  const buyerReview = await createServiceOrderReview(orderId, buyerId, {
    targetType: ServiceOrderReviewTargetType.SELLER,
    rating: 5,
    content: '服务非常满意',
    tags: ['专业', '守时'],
  });
  assert(buyerReview.rating === 5, '买方评价星级写入');
  assert(buyerReview.toUserId === sellerId, '买方评价对象指向卖方');

  // 重复评价应失败
  let duplicateReviewBlocked = false;
  try {
    await createServiceOrderReview(orderId, buyerId, {
      targetType: ServiceOrderReviewTargetType.SELLER,
      rating: 4,
    });
  } catch (err) {
    duplicateReviewBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_REVIEW_ALREADY_EXISTS;
  }
  assert(duplicateReviewBlocked, '同方向重复评价被拦截');

  // 卖方评价买方
  const sellerReview = await createServiceOrderReview(orderId, sellerId, {
    targetType: ServiceOrderReviewTargetType.BUYER,
    rating: 4,
    content: '客人配合度高',
  });
  assert(sellerReview.rating === 4, '卖方评价星级写入');
  assert(sellerReview.toUserId === buyerId, '卖方评价对象指向买方');

  // 卖方回复买方评价
  const replied = await replyToServiceOrderReview(buyerReview.id, sellerId, {
    replyContent: '感谢认可，期待再会',
  });
  assert(replied.replyContent === '感谢认可，期待再会', '评价回复写入');
  assert(replied.replyAt != null, '回复时间写入');

  // 非被评价方回复应失败
  let replyBlocked = false;
  try {
    await replyToServiceOrderReview(buyerReview.id, buyerId, { replyContent: '越权回复' });
  } catch (err) {
    replyBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_REVIEW_REPLY_FORBIDDEN;
  }
  assert(replyBlocked, '非被评价方回复被拦截');

  // 列表可读
  const reviews = await listServiceOrderReviews(orderId, buyerId);
  assert(reviews.length === 2, '评价列表含双向评价');
  assert(reviews.some((r) => r.replyContent != null), '列表包含已回复评价');

  console.log('');
}

/**
 * 验证争议与仲裁流程。
 *
 * @param orderId - 订单 ID
 * @param buyerId - 买方 ID
 * @param sellerId - 卖方 ID
 */
async function checkDisputes(orderId: number, buyerId: number, sellerId: number) {
  console.log('--- 履约争议 ---');

  // 买方发起争议
  const dispute = await createServiceOrderDispute(orderId, buyerId, {
    type: ServiceOrderDisputeType.QUALITY,
    reason: '实际服务与方案描述不符',
  });
  assert(dispute.type === ServiceOrderDisputeType.QUALITY, '争议类型写入');
  assert(dispute.status === ServiceOrderDisputeStatus.PENDING, '争议状态 pending');
  assert(dispute.respondentUserId === sellerId, '被申诉方指向卖方');

  // 重复未结案争议应失败
  let duplicateDisputeBlocked = false;
  try {
    await createServiceOrderDispute(orderId, buyerId, {
      type: ServiceOrderDisputeType.OTHER,
      reason: '重复争议',
    });
  } catch (err) {
    duplicateDisputeBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_DISPUTE_ALREADY_EXISTS;
  }
  assert(duplicateDisputeBlocked, '重复未结案争议被拦截');

  // 管理端列表可读
  const adminList = await listServiceOrderDisputesForAdmin({
    page: 1,
    pageSize: 20,
    status: ServiceOrderDisputeStatus.PENDING,
  });
  assert(adminList.items.some((item) => item.id === dispute.id), '管理端争议列表含本争议');

  // 记录仲裁前信用分
  const creditBefore = await getProviderCreditScore(sellerId);

  // 平台仲裁：买方胜诉
  const resolved = await resolveServiceOrderDispute(dispute.id, buyerId, {
    status: ServiceOrderDisputeStatus.RESOLVED_BUYER,
    platformNote: '核实服务存在偏差，支持买方',
  });
  assert(resolved.status === ServiceOrderDisputeStatus.RESOLVED_BUYER, '争议已结案（买方胜诉）');
  assert(resolved.platformNote === '核实服务存在偏差，支持买方', '平台备注写入');
  assert(resolved.resolvedAt != null, '结案时间写入');

  // 信用分应扣减
  const creditAfter = await getProviderCreditScore(sellerId);
  assert(creditAfter != null && creditAfter < creditBefore!, '纠纷卖方信用分扣减');

  // 再次发起争议应允许（已结案）
  const secondDispute = await createServiceOrderDispute(orderId, buyerId, {
    type: ServiceOrderDisputeType.SCHEDULE,
    reason: '新的争议',
  });
  assert(secondDispute.status === ServiceOrderDisputeStatus.PENDING, '结案后可再次发起争议');

  // 列表可读
  const disputes = await listServiceOrderDisputes(orderId, buyerId);
  assert(disputes.length === 2, '争议列表含两条记录');

  console.log('');
}

/**
 * 验证 DB 中评价与争议表存在且可读写。
 */
async function checkSchema() {
  console.log('--- Schema ---');
  const db = getDb();
  const reviewRows = await db.select({ id: serviceOrderReview.id }).from(serviceOrderReview).limit(1);
  assert(reviewRows.length >= 0, 'service_order_review 表可读');
  const disputeRows = await db.select({ id: serviceOrderDispute.id }).from(serviceOrderDispute).limit(1);
  assert(disputeRows.length >= 0, 'service_order_dispute 表可读');
  console.log('');
}

async function main() {
  failed = 0;
  await checkSchema();
  checkI18nKeys();
  const { orderId, buyerId, sellerId } = await prepareConfirmedOrder();
  await checkReviews(orderId, buyerId, sellerId);
  await checkDisputes(orderId, buyerId, sellerId);

  console.log('--- 结果 ---');
  if (failed > 0) {
    console.error(`M-TRUST-01 Marketplace 履约评价与争议处理验收失败：${failed} 项未通过`);
    process.exit(1);
  }
  console.log('M-TRUST-01 Marketplace 履约评价与争议处理验收全部通过');
  process.exit(0);
}

main().catch((err) => {
  console.error('[m7-ext] 未捕获异常:', err);
  process.exit(1);
});
