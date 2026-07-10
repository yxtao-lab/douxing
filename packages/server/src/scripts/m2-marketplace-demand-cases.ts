/**
 * M2 · 发单接单首单闭环验收
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server m2:marketplace-demand-cases
 */
import '../config/env.js';
import { eq } from 'drizzle-orm';
import {
  ApiMessageKey,
  BizOrgStatus,
  BizOrgType,
  CertStatus,
  DemandStatus,
  OrgDocumentType,
  OrgRole,
  ProviderType,
  QuoteStatus,
  ServiceOrderStatus,
  resolveApiMessage,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { bizOrg, orgMember } from '../db/schema/marketplace-biz-org.js';
import { bizOrgDocument } from '../db/schema/marketplace-biz-org-documents.js';
import { serviceProvider } from '../db/schema/marketplace-provider.js';
import { demandQuote, serviceDemand } from '../db/schema/marketplace-demand.js';
import { serviceOrder } from '../db/schema/marketplace-order.js';
import {
  applyBizOrg,
  getOrgRoleForUser,
  reviewBizOrg,
} from '../services/marketplace/marketplace-org-onboard.service.js';
import {
  applyServiceProvider,
  isApprovedServiceProvider,
  reviewServiceProvider,
} from '../services/marketplace/marketplace-provider.service.js';
import {
  createDemand,
  listPublishedDemands,
  publishDemand,
} from '../services/marketplace/marketplace-demand.service.js';
import { createDemandQuote } from '../services/marketplace/marketplace-quote.service.js';
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
 * 获取或创建 M2 测试专用用户。
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
    passwordHash: 'm2-test-placeholder',
    nickname: username,
    email: `${username}@m2.test`,
  });
  return Number(result.insertId);
}

/**
 * 清理测试用户关联的发单/报价/订单数据。
 *
 * @param userId - 发单方用户 ID
 */
async function cleanupPublisherData(userId: number): Promise<void> {
  const db = getDb();
  const demands = await db
    .select({ id: serviceDemand.id })
    .from(serviceDemand)
    .where(eq(serviceDemand.publisherUserId, userId));

  for (const d of demands) {
    await db.delete(serviceOrder).where(eq(serviceOrder.demandId, d.id));
    await db.delete(demandQuote).where(eq(demandQuote.demandId, d.id));
    await db.delete(serviceDemand).where(eq(serviceDemand.id, d.id));
  }
}

/**
 * 清理服务方测试数据。
 *
 * @param userId - 服务方用户 ID
 */
async function cleanupProviderData(userId: number): Promise<void> {
  const db = getDb();
  await db.delete(serviceProvider).where(eq(serviceProvider.userId, userId));

  const memberships = await db
    .select({ orgId: orgMember.orgId })
    .from(orgMember)
    .where(eq(orgMember.userId, userId));

  for (const row of memberships) {
    await db.delete(bizOrgDocument).where(eq(bizOrgDocument.orgId, row.orgId));
    await db.delete(orgMember).where(eq(orgMember.orgId, row.orgId));
    await db.delete(bizOrg).where(eq(bizOrg.id, row.orgId));
  }
}

/**
 * 确保存在已审核通过的服务方（个人认证）。
 *
 * @returns 服务方用户 ID 与 provider 记录 ID
 */
async function ensureApprovedProvider(): Promise<{ userId: number; providerId: number }> {
  const username = 'm2_provider';
  const userId = await ensureTestUser(username);
  await cleanupProviderData(userId);

  const applied = await applyServiceProvider(userId, {
    providerType: ProviderType.GUIDE,
    categoryCodes: ['travel.custom_tour', 'travel.guide'],
    serviceRegions: ['杭州'],
    displayName: 'M2 测试向导',
    bio: 'M2 验收服务者',
  });

  const reviewerRows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, 'admin'))
    .limit(1);
  const reviewerId = reviewerRows[0]?.id ?? userId;

  const approved = await reviewServiceProvider(applied.id, reviewerId, { action: 'approve' });
  assert(approved.certStatus === CertStatus.APPROVED, '服务者审核通过');
  assert(await isApprovedServiceProvider(userId), '服务者具备报价资格');

  return { userId, providerId: approved.id };
}

/**
 * 检查 M2 新增 i18n 键。
 */
function checkI18nKeys() {
  console.log('--- i18n ---');
  const keys = [
    ApiMessageKey.MARKETPLACE_DEMAND_INVALID,
    ApiMessageKey.MARKETPLACE_QUOTE_ALREADY_EXISTS,
    ApiMessageKey.MARKETPLACE_ORDER_NOT_FOUND,
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
 * 走通发单 → 报价 → 选定 → 模拟支付 → 履约全链。
 */
async function checkFullDemandFlow() {
  console.log('--- 首单闭环 ---');

  const publisherUsername = 'm2_publisher';
  const publisherId = await ensureTestUser(publisherUsername);
  await cleanupPublisherData(publisherId);

  const { userId: providerUserId } = await ensureApprovedProvider();

  const draft = await createDemand(publisherId, {
    categoryCode: 'travel.custom_tour',
    title: 'M2 杭州三日定制游',
    description: '家庭出游，需要亲子友好行程',
    destination: '杭州',
    budgetMin: '5000',
    budgetMax: '10000',
    budgetType: 'range',
  });
  assert(draft.status === DemandStatus.DRAFT, '创建草稿');

  const published = await publishDemand(draft.id, publisherId);
  assert(published.status === DemandStatus.PUBLISHED, '发布需求');

  const hall = await listPublishedDemands({ page: 1, pageSize: 10, destination: '杭州' });
  assert(hall.items.some((item) => item.id === draft.id), '需求大厅可见');

  const quote = await createDemandQuote(draft.id, providerUserId, {
    amount: '6800.00',
    proposalText: '含住宿与门票，亲子友好路线',
  });
  assert(quote.status === QuoteStatus.PENDING, '提交报价');

  const demandAfterQuote = await getDb()
    .select({ status: serviceDemand.status })
    .from(serviceDemand)
    .where(eq(serviceDemand.id, draft.id))
    .limit(1);
  assert(demandAfterQuote[0]?.status === DemandStatus.QUOTING, '首条报价后 status=quoting');

  const order = await selectQuoteAndCreateOrder(draft.id, publisherId, { quoteId: quote.id });
  assert(order.status === ServiceOrderStatus.PENDING_PAY, '选定报价生成 pending_pay 订单');
  assert(order.totalAmount === '6800.00', '订单金额与报价一致');

  const demandSelected = await getDb()
    .select({ status: serviceDemand.status })
    .from(serviceDemand)
    .where(eq(serviceDemand.id, draft.id))
    .limit(1);
  assert(demandSelected[0]?.status === DemandStatus.SELECTED, '选定后需求 status=selected');

  const paid = await payMockServiceOrder(order.id, publisherId);
  assert(paid.status === ServiceOrderStatus.PAID, '模拟支付后 status=paid');

  const contracted = await getDb()
    .select({ status: serviceDemand.status })
    .from(serviceDemand)
    .where(eq(serviceDemand.id, draft.id))
    .limit(1);
  assert(contracted[0]?.status === DemandStatus.CONTRACTED, '支付后需求 status=contracted');

  const inProgress = await advanceServiceOrderStatus(order.id, publisherId, {
    status: ServiceOrderStatus.IN_PROGRESS,
  });
  assert(inProgress.status === ServiceOrderStatus.IN_PROGRESS, '推进 in_progress');

  const delivered = await advanceServiceOrderStatus(order.id, publisherId, {
    status: ServiceOrderStatus.DELIVERED,
  });
  assert(delivered.status === ServiceOrderStatus.DELIVERED, '推进 delivered');

  const confirmed = await advanceServiceOrderStatus(order.id, publisherId, {
    status: ServiceOrderStatus.CONFIRMED,
  });
  assert(confirmed.status === ServiceOrderStatus.CONFIRMED, '推进 confirmed');

  const completed = await getDb()
    .select({ status: serviceDemand.status })
    .from(serviceDemand)
    .where(eq(serviceDemand.id, draft.id))
    .limit(1);
  assert(completed[0]?.status === DemandStatus.COMPLETED, '确认后需求 status=completed');

  console.log('');
}

/**
 * 校验商户组织报价路径（org 成员代 org 报价）。
 */
async function checkOrgQuotePath() {
  console.log('--- 商户报价 ---');
  const orgOwnerUsername = 'm2_org_owner';
  const publisherUsername = 'm2_org_publisher';
  const ownerId = await ensureTestUser(orgOwnerUsername);
  const publisherId = await ensureTestUser(publisherUsername);
  await cleanupProviderData(ownerId);
  await cleanupPublisherData(publisherId);

  const applied = await applyBizOrg(ownerId, {
    name: 'M2 测试摄影工作室',
    orgType: BizOrgType.PHOTO_STUDIO,
    licenseNo: 'M2-PHOTO-001',
    contactPhone: '13800000002',
    documents: [
      {
        docType: OrgDocumentType.LICENSE,
        fileUrl: '/uploads/marketplace/test/m2-license.pdf',
        fileName: 'license.pdf',
      },
    ],
  });

  const reviewerRows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, 'admin'))
    .limit(1);
  const reviewerId = reviewerRows[0]?.id ?? ownerId;

  const approvedOrg = await reviewBizOrg(applied.id, reviewerId, { action: 'approve' });
  assert(approvedOrg.status === BizOrgStatus.ACTIVE, '商户审核通过');

  const role = await getOrgRoleForUser(ownerId, applied.id);
  assert(role === OrgRole.OWNER, '商户 owner 角色');

  const demand = await createDemand(publisherId, {
    categoryCode: 'photo.travel_shoot',
    title: 'M2 西湖旅拍需求',
    destination: '杭州',
  });
  await publishDemand(demand.id, publisherId);

  const orgQuote = await createDemandQuote(demand.id, ownerId, {
    amount: '3200.00',
    proposalText: '含精修 30 张',
    orgId: applied.id,
  });
  assert(orgQuote.orgId === applied.id, '商户 org 报价写入 org_id');
  assert(orgQuote.providerUserId == null, '商户报价无 provider_user_id');

  await cleanupPublisherData(publisherId);
  await cleanupProviderData(ownerId);
  console.log('');
}

async function main() {
  console.log('=== M2 Marketplace 发单 MVP 验收 ===\n');
  checkI18nKeys();
  await checkFullDemandFlow();
  await checkOrgQuotePath();

  console.log('');
  if (failed > 0) {
    console.error(`\n${failed} 项失败`);
    process.exit(1);
  }
  console.log('M2 Marketplace 发单 MVP 验收全部通过');
  process.exit(0);
}

main().catch((err) => {
  console.error('[m2-marketplace-demand-cases] 运行失败:', err);
  process.exit(1);
});
