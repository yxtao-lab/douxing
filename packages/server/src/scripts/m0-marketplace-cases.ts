/**
 * M0 · 发单接单领域建模验收
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server m0:marketplace-cases
 */
import '../config/env.js';
import express from 'express';
import { eq } from 'drizzle-orm';
import {
  ApiMessageKey,
  SERVICE_CATEGORY_TREE,
  resolveApiMessage,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { bizOrg, orgMember } from '../db/schema/marketplace-biz-org.js';
import { serviceProvider } from '../db/schema/marketplace-provider.js';
import { demandGroup, groupMember, serviceDemand, demandQuote } from '../db/schema/marketplace-demand.js';
import { serviceOrder } from '../db/schema/marketplace-order.js';
import { listServiceCategories } from '../services/marketplace/marketplace-category.service.js';
import { generateDemandNo } from '../services/marketplace/marketplace-org.service.js';
import { listDemandsByUser } from '../services/marketplace/marketplace-demand.service.js';
import { seedMarketplaceDemo } from '../services/marketplace/marketplace-seed.service.js';
import marketplaceRouter from '../routes/marketplace/index.js';
import { localeMiddleware } from '../middleware/locale.js';

const MARKETPLACE_TABLE_CHECKS: Array<{ label: string; run: () => Promise<unknown> }> = [
  { label: 'biz_org', run: () => getDb().select({ id: bizOrg.id }).from(bizOrg).limit(1) },
  { label: 'org_member', run: () => getDb().select({ id: orgMember.id }).from(orgMember).limit(1) },
  { label: 'service_provider', run: () => getDb().select({ id: serviceProvider.id }).from(serviceProvider).limit(1) },
  { label: 'demand_group', run: () => getDb().select({ id: demandGroup.id }).from(demandGroup).limit(1) },
  { label: 'group_member', run: () => getDb().select({ id: groupMember.id }).from(groupMember).limit(1) },
  { label: 'service_demand', run: () => getDb().select({ id: serviceDemand.id }).from(serviceDemand).limit(1) },
  { label: 'demand_quote', run: () => getDb().select({ id: demandQuote.id }).from(demandQuote).limit(1) },
  { label: 'service_order', run: () => getDb().select({ id: serviceOrder.id }).from(serviceOrder).limit(1) },
];

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
 * 检查 marketplace 相关表是否均已创建。
 */
async function checkTables() {
  console.log('--- 数据库表 ---');
  for (const item of MARKETPLACE_TABLE_CHECKS) {
    try {
      await item.run();
      assert(true, `表 ${item.label} 存在`);
    } catch {
      assert(false, `表 ${item.label} 存在`);
    }
  }
  console.log('');
}

/**
 * 检查 shared 类目树与 service 层一致。
 */
function checkCategories() {
  console.log('--- 类目树 ---');
  const categories = listServiceCategories();
  assert(categories.length >= 3, '至少 3 个一级类目');
  assert(categories[0]?.code === SERVICE_CATEGORY_TREE[0]?.code, 'listServiceCategories 与 shared 常量一致');
  const leafCount = categories.reduce((sum, node) => sum + (node.children?.length ?? 0), 0);
  assert(leafCount >= 10, '叶子类目数量充足');
  console.log('');
}

/**
 * 检查 marketplace 相关 ApiMessageKey i18n。
 */
function checkI18n() {
  console.log('--- API i18n ---');
  const keys = [
    ApiMessageKey.MARKETPLACE_ORG_NOT_FOUND,
    ApiMessageKey.MARKETPLACE_DEMAND_NOT_FOUND,
    ApiMessageKey.MARKETPLACE_DEMAND_FORBIDDEN,
    ApiMessageKey.MARKETPLACE_CATEGORY_INVALID,
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
 * 检查种子数据与需求单号生成。
 */
async function checkSeedAndNumbers() {
  console.log('--- 种子与单号 ---');
  const demoRows = await getDb().select({ id: users.id }).from(users).where(eq(users.username, 'demo')).limit(1);
  const demoUserId = demoRows[0]?.id ?? null;
  assert(demoUserId != null, 'demo 用户存在');

  if (demoUserId) {
    await seedMarketplaceDemo(demoUserId);

    const orgRows = await getDb().select({ id: bizOrg.id }).from(bizOrg);
    assert(orgRows.length >= 1, 'seed 后 biz_org ≥ 1');

    const demandRows = await getDb().select({ id: serviceDemand.id }).from(serviceDemand);
    assert(demandRows.length >= 1, 'seed 后 service_demand ≥ 1');

    const mine = await listDemandsByUser(demoUserId);
    assert(mine.some((item) => item.status === 'draft'), 'demo 用户有 draft 需求单');
  }

  const no1 = generateDemandNo();
  const no2 = generateDemandNo();
  assert(no1.startsWith('SD'), 'demand_no 以 SD 前缀');
  assert(no1 !== no2, 'demand_no 连续生成不重复');
  console.log('');
}

/**
 * 通过内存 Express 实例验证 health / categories HTTP 路由。
 */
async function checkHttpRoutes(): Promise<void> {
  console.log('--- HTTP 路由 ---');
  const app = express();
  app.use(localeMiddleware);
  app.use('/api/marketplace', marketplaceRouter);

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  try {
    const healthRes = await fetch(`http://127.0.0.1:${port}/api/marketplace/health`);
    assert(healthRes.status === 200, 'GET /api/marketplace/health → 200');
    const healthJson = (await healthRes.json()) as { data?: { module?: string } };
    assert(healthJson.data?.module === 'marketplace', 'health 返回 module=marketplace');

    const catRes = await fetch(`http://127.0.0.1:${port}/api/marketplace/categories`);
    assert(catRes.status === 200, 'GET /api/marketplace/categories → 200');
    const catJson = (await catRes.json()) as { data?: { categories?: unknown[] } };
    assert((catJson.data?.categories?.length ?? 0) >= 3, 'categories 返回类目树');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
  console.log('');
}

async function main() {
  console.log('=== M0 Marketplace 验收 ===\n');
  await checkTables();
  checkCategories();
  checkI18n();
  await checkSeedAndNumbers();
  await checkHttpRoutes();

  console.log('');
  if (failed > 0) {
    console.error(`\n${failed} 项失败`);
    process.exit(1);
  }
  console.log('M0 Marketplace 验收全部通过');
  process.exit(0);
}

main().catch((err) => {
  console.error('[m0-marketplace-cases] 运行失败:', err);
  process.exit(1);
});
