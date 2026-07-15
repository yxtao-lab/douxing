/**
 * M4 · 发单接单撮合增强验收（M4-1～M4-5）
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server m4:marketplace-match-cases
 */
import '../config/env.js';
import { eq, inArray } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  CertStatus,
  CREDIT_DELTA_DISPUTE,
  CREDIT_DELTA_ORDER_CONFIRMED,
  DEFAULT_MATCH_WEIGHTS,
  DemandStatus,
  MarketplaceNotificationType,
  ProviderType,
  QuoteSortReason,
  QuoteStatus,
  ServiceOrderStatus,
  resolveApiMessage,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { demandQuote, serviceDemand } from '../db/schema/marketplace-demand.js';
import { serviceOrder } from '../db/schema/marketplace-order.js';
import { marketplaceNotification } from '../db/schema/marketplace-notification.js';
import { serviceProvider } from '../db/schema/marketplace-provider.js';
import {
  createDemand,
  publishDemand,
} from '../services/marketplace/marketplace-demand.service.js';
import {
  getMatchWeights,
  matchProvidersForDemand,
  resetMatchWeights,
  setMatchWeights,
} from '../services/marketplace/marketplace-match.service.js';
import {
  applyCreditForDispute,
  getProviderCreditScore,
  setProviderCreditScoreForTest,
} from '../services/marketplace/marketplace-credit.service.js';
import {
  countDemandMatchNotifications,
  listNotificationsForUser,
  markNotificationRead,
} from '../services/marketplace/marketplace-notification.service.js';
import {
  applyServiceProvider,
  reviewServiceProvider,
} from '../services/marketplace/marketplace-provider.service.js';
import { createDemandQuote, listQuotesForDemand } from '../services/marketplace/marketplace-quote.service.js';
import {
  advanceServiceOrderStatus,
  payMockServiceOrder,
  selectQuoteAndCreateOrder,
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
 * 获取或创建 M4 测试专用用户。
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
    passwordHash: 'm4-test-placeholder',
    nickname: username,
    email: `${username}@m4.test`,
  });
  return Number(result.insertId);
}

/**
 * 按需求 ID 列表删除订单、报价、通知与需求本身。
 *
 * @param demandIds - 需求主键列表
 */
async function deleteDemandsCascade(demandIds: number[]): Promise<void> {
  if (demandIds.length === 0) return;
  const db = getDb();
  await db.delete(serviceOrder).where(inArray(serviceOrder.demandId, demandIds));
  await db.delete(demandQuote).where(inArray(demandQuote.demandId, demandIds));
  await db
    .delete(marketplaceNotification)
    .where(inArray(marketplaceNotification.refId, demandIds));
  await db.delete(serviceDemand).where(inArray(serviceDemand.id, demandIds));
}

/**
 * 清理发单人相关需求与通知。
 *
 * @param userId - 发单人用户 ID
 */
async function cleanupPublisherData(userId: number): Promise<void> {
  const db = getDb();
  const demands = await db
    .select({ id: serviceDemand.id })
    .from(serviceDemand)
    .where(eq(serviceDemand.publisherUserId, userId));
  await deleteDemandsCascade(demands.map((row) => row.id));
}

/**
 * 清理服务者档案及其通知。
 *
 * @param userId - 服务者用户 ID
 */
async function cleanupProviderData(userId: number): Promise<void> {
  const db = getDb();
  await db.delete(marketplaceNotification).where(eq(marketplaceNotification.userId, userId));
  await db.delete(serviceProvider).where(eq(serviceProvider.userId, userId));
}

/**
 * 确保存在已审核通过的服务者。
 *
 * @param username - 用户名
 * @param options - 类目、区域与展示名
 * @returns 用户 ID 与 provider ID
 */
async function ensureApprovedProvider(
  username: string,
  options: {
    categoryCodes: string[];
    serviceRegions: string[];
    displayName: string;
  },
): Promise<{ userId: number; providerId: number }> {
  const userId = await ensureTestUser(username);
  await cleanupProviderData(userId);

  const applied = await applyServiceProvider(userId, {
    providerType: ProviderType.GUIDE,
    categoryCodes: options.categoryCodes,
    serviceRegions: options.serviceRegions,
    displayName: options.displayName,
    bio: 'M4 验收服务者',
  });

  const reviewerRows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, 'admin'))
    .limit(1);
  const reviewerId = reviewerRows[0]?.id ?? userId;

  const approved = await reviewServiceProvider(applied.id, reviewerId, { action: 'approve' });
  assert(approved.certStatus === CertStatus.APPROVED, `${username} 审核通过`);
  return { userId, providerId: approved.id };
}

/**
 * 检查 M4 新增 i18n 键。
 */
function checkI18nKeys() {
  console.log('--- i18n ---');
  const keys = [
    ApiMessageKey.MARKETPLACE_DEMAND_MATCHED,
    ApiMessageKey.MARKETPLACE_NOTIFICATION_NOT_FOUND,
    ApiMessageKey.MARKETPLACE_MATCH_WEIGHTS_INVALID,
  ] as const;

  for (const key of keys) {
    const zh = resolveApiMessage(key, 'zh-CN', { title: '测试需求' });
    const en = resolveApiMessage(key, 'en-US', { title: 'Test demand' });
    assert(zh.length > 0 && zh !== key, `zh-CN ${key}`);
    assert(en.length > 0 && en !== key, `en-US ${key}`);
  }
  assert(zhContainsTitle(resolveApiMessage(ApiMessageKey.MARKETPLACE_DEMAND_MATCHED, 'zh-CN', { title: '西湖旅拍' })), '匹配文案含 title');
  console.log('');
}

/**
 * 判断中文匹配文案是否包含标题。
 *
 * @param text - 解析后文案
 * @returns 含「西湖旅拍」为 true
 */
function zhContainsTitle(text: string): boolean {
  return text.includes('西湖旅拍');
}

/**
 * M4-1：匹配规则引擎（类目 + 区域 + 档期占位 + 可配置权重）。
 */
async function checkMatchEngine() {
  console.log('--- M4-1 匹配引擎 ---');

  resetMatchWeights();
  const weights = getMatchWeights();
  assert(weights.category === DEFAULT_MATCH_WEIGHTS.category, '默认类目权重');
  assert(weights.region === DEFAULT_MATCH_WEIGHTS.region, '默认区域权重');
  assert(weights.schedule === DEFAULT_MATCH_WEIGHTS.schedule, '默认档期权重');

  const overridden = setMatchWeights({ category: 50, region: 30, schedule: 20 });
  assert(overridden.category === 50 && overridden.region === 30, '可配置权重生效');
  resetMatchWeights();

  try {
    setMatchWeights({ category: 0 });
    assert(false, '非法权重应抛错');
  } catch (err) {
    assert(err instanceof ApiError, '非法权重抛 ApiError');
  }
  resetMatchWeights();

  const publisherId = await ensureTestUser('m4_publisher');
  await cleanupPublisherData(publisherId);

  const hit = await ensureApprovedProvider('m4_provider_hit', {
    categoryCodes: ['travel.custom_tour', 'travel.guide'],
    serviceRegions: ['杭州'],
    displayName: 'M4 命中向导',
  });
  const missCategory = await ensureApprovedProvider('m4_provider_miss_cat', {
    categoryCodes: ['talent.photographer'],
    serviceRegions: ['杭州'],
    displayName: 'M4 类目不匹配',
  });
  const missRegion = await ensureApprovedProvider('m4_provider_miss_region', {
    categoryCodes: ['travel.custom_tour'],
    serviceRegions: ['成都'],
    displayName: 'M4 区域不匹配',
  });
  const pendingUserId = await ensureTestUser('m4_provider_pending');
  await cleanupProviderData(pendingUserId);
  await applyServiceProvider(pendingUserId, {
    providerType: ProviderType.GUIDE,
    categoryCodes: ['travel.custom_tour'],
    serviceRegions: ['杭州'],
    displayName: 'M4 未审核',
  });

  const draft = await createDemand(publisherId, {
    categoryCode: 'travel.custom_tour',
    title: 'M4 杭州定制游匹配',
    description: '匹配引擎验收',
    destination: '杭州西湖',
    startDate: '2026-08-01',
    endDate: '2026-08-03',
    budgetMin: '3000',
    budgetMax: '8000',
    budgetType: 'range',
  });

  const candidates = await matchProvidersForDemand(draft.id);
  assert(
    candidates.some((item) => item.userId === hit.userId),
    '类目+区域命中进入候选',
  );
  assert(
    !candidates.some((item) => item.userId === missCategory.userId),
    '类目不匹配被硬过滤',
  );
  const regionCandidate = candidates.find((item) => item.userId === missRegion.userId);
  assert(regionCandidate != null, '类目命中区域未命中仍可入选（仅类目分）');
  assert(regionCandidate?.matchedRegion === false, '区域未命中标记');
  assert(
    !candidates.some((item) => item.userId === pendingUserId),
    '未审核服务者不匹配',
  );

  const hitCandidate = candidates.find((item) => item.userId === hit.userId)!;
  assert(hitCandidate.matchedSchedule === true, '档期占位通过');
  assert(
    hitCandidate.score ===
      DEFAULT_MATCH_WEIGHTS.category +
        DEFAULT_MATCH_WEIGHTS.region +
        DEFAULT_MATCH_WEIGHTS.schedule,
    '满分 = 三类权重之和',
  );

  await deleteDemandsCascade([draft.id]);
  console.log('');
}

/**
 * M4-2：发布后站内通知匹配服务方。
 */
async function checkMatchNotify() {
  console.log('--- M4-2 站内推送 ---');

  const publisherId = await ensureTestUser('m4_publisher');
  await cleanupPublisherData(publisherId);

  const hit = await ensureApprovedProvider('m4_provider_hit', {
    categoryCodes: ['travel.custom_tour'],
    serviceRegions: ['杭州'],
    displayName: 'M4 命中向导',
  });
  const miss = await ensureApprovedProvider('m4_provider_miss_cat', {
    categoryCodes: ['talent.photographer'],
    serviceRegions: ['杭州'],
    displayName: 'M4 类目不匹配',
  });

  const draft = await createDemand(publisherId, {
    categoryCode: 'travel.custom_tour',
    title: 'M4 推送验收需求',
    destination: '杭州',
    budgetMin: '2000',
    budgetMax: '5000',
    budgetType: 'range',
  });

  const published = await publishDemand(draft.id, publisherId);
  assert(published.status === DemandStatus.PUBLISHED, '发布成功');

  const hitCount = await countDemandMatchNotifications(hit.userId, draft.id);
  const missCount = await countDemandMatchNotifications(miss.userId, draft.id);
  assert(hitCount >= 1, '命中服务方收到匹配通知');
  assert(missCount === 0, '未命中服务方无通知');

  const notifications = await listNotificationsForUser(hit.userId, { unreadOnly: true });
  const matchNote = notifications.find(
    (item) =>
      item.type === MarketplaceNotificationType.DEMAND_MATCH && item.refId === draft.id,
  );
  assert(matchNote != null, '未读列表含匹配通知');
  assert(matchNote!.messageKey === ApiMessageKey.MARKETPLACE_DEMAND_MATCHED, '通知 messageKey');
  assert(matchNote!.payload?.title === 'M4 推送验收需求', '通知 payload.title');

  const read = await markNotificationRead(matchNote!.id, hit.userId);
  assert(read.readAt != null, '标记已读');

  const unreadAfter = await listNotificationsForUser(hit.userId, { unreadOnly: true });
  assert(
    !unreadAfter.some((item) => item.id === matchNote!.id),
    '已读后不再出现在未读列表',
  );

  await deleteDemandsCascade([draft.id]);
  console.log('');
}

/**
 * M4-3：订单完成加分 + 纠纷减分占位。
 */
async function checkCredit() {
  console.log('--- M4-3 信用分 ---');

  const publisherId = await ensureTestUser('m4_publisher');
  await cleanupPublisherData(publisherId);

  const provider = await ensureApprovedProvider('m4_provider_credit', {
    categoryCodes: ['travel.custom_tour'],
    serviceRegions: ['杭州'],
    displayName: 'M4 信用向导',
  });

  const before = await getProviderCreditScore(provider.userId);
  assert(before === 100, '初始信用分 100');

  const draft = await createDemand(publisherId, {
    categoryCode: 'travel.custom_tour',
    title: 'M4 信用加分订单',
    destination: '杭州',
    budgetMin: '1000',
    budgetMax: '3000',
    budgetType: 'range',
  });
  await publishDemand(draft.id, publisherId);

  const quote = await createDemandQuote(draft.id, provider.userId, {
    amount: '1800.00',
    proposalText: '信用验收报价',
  });
  const order = await selectQuoteAndCreateOrder(draft.id, publisherId, { quoteId: quote.id });
  await payMockServiceOrder(order.id, publisherId);

  await advanceServiceOrderStatus(order.id, publisherId, {
    status: ServiceOrderStatus.IN_PROGRESS,
  });
  await advanceServiceOrderStatus(order.id, publisherId, {
    status: ServiceOrderStatus.DELIVERED,
  });
  await advanceServiceOrderStatus(order.id, publisherId, {
    status: ServiceOrderStatus.CONFIRMED,
  });

  const afterConfirm = await getProviderCreditScore(provider.userId);
  assert(
    afterConfirm === (before ?? 100) + CREDIT_DELTA_ORDER_CONFIRMED,
    `履约确认加 ${CREDIT_DELTA_ORDER_CONFIRMED} 分`,
  );

  const disputed = await applyCreditForDispute(provider.userId);
  assert(
    disputed.after === disputed.before + CREDIT_DELTA_DISPUTE,
    `纠纷占位减 ${Math.abs(CREDIT_DELTA_DISPUTE)} 分`,
  );

  await deleteDemandsCascade([draft.id]);
  console.log('');
}

/**
 * M4-4：报价按信用 + 金额排序，并带 sortReasonKey。
 */
async function checkQuoteSort() {
  console.log('--- M4-4 报价排序 ---');

  const publisherId = await ensureTestUser('m4_publisher');
  await cleanupPublisherData(publisherId);

  const highCredit = await ensureApprovedProvider('m4_provider_sort_hi', {
    categoryCodes: ['travel.custom_tour'],
    serviceRegions: ['杭州'],
    displayName: '高信用',
  });
  const lowCredit = await ensureApprovedProvider('m4_provider_sort_lo', {
    categoryCodes: ['travel.custom_tour'],
    serviceRegions: ['杭州'],
    displayName: '低信用',
  });

  await setProviderCreditScoreForTest(highCredit.userId, 130);
  await setProviderCreditScoreForTest(lowCredit.userId, 90);

  const draft = await createDemand(publisherId, {
    categoryCode: 'travel.custom_tour',
    title: 'M4 排序验收',
    destination: '杭州',
    budgetMin: '1000',
    budgetMax: '5000',
    budgetType: 'range',
  });
  await publishDemand(draft.id, publisherId);

  await createDemandQuote(draft.id, lowCredit.userId, {
    amount: '2000.00',
    proposalText: '低信用低价',
  });
  await createDemandQuote(draft.id, highCredit.userId, {
    amount: '2500.00',
    proposalText: '高信用稍贵',
  });

  const quotes = await listQuotesForDemand(draft.id);
  assert(quotes.length === 2, '两条报价');
  assert(quotes[0]!.providerUserId === highCredit.userId, '高信用排前');
  assert(quotes[0]!.providerCreditScore === 130, '信用分透出');
  assert(quotes[0]!.sortReasonKey === QuoteSortReason.CREDIT_THEN_AMOUNT, '排序理由 key');
  assert(quotes[1]!.providerUserId === lowCredit.userId, '低信用排后');
  assert(quotes.every((item) => item.status === QuoteStatus.PENDING), '报价状态 pending');

  await deleteDemandsCascade([draft.id]);
  console.log('');
}

/**
 * 入口：顺序执行 M4 验收用例。
 */
async function main() {
  console.log('=== M4 marketplace match cases ===\n');
  checkI18nKeys();
  await checkMatchEngine();
  await checkMatchNotify();
  await checkCredit();
  await checkQuoteSort();

  if (failed > 0) {
    console.error(`\nM4 验收失败：${failed} 项`);
    process.exit(1);
  }
  console.log('\nM4 验收全部通过（MB3 达成）');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
