/**
 * M2-ext · A-CLOSE-01 路线一键发定制需求验收
 *
 * 验证内容：
 * 1. 创建路线后，带 routeId 发定制需求，需求单 routeId 正确回填
 * 2. 预算范围解析为 budgetMin / budgetMax
 * 3. 目的地从 matchedCity 带出
 * 4. 非本人路线带 routeId 发单被拦截
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server m2-ext:route-to-demand-cases
 */
import '../config/env.js';
import { and, eq } from 'drizzle-orm';
import {
  ApiError,
  DemandStatus,
  PublisherType,
  SERVICE_CATEGORY_TREE,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { serviceDemand } from '../db/schema/marketplace-demand.js';
import {
  createDemand,
  publishDemand,
} from '../services/marketplace/marketplace-demand.service.js';

let failed = 0;

/**
 * 断言条件为真，失败时累计失败计数并打印标签。
 *
 * @param condition - 期望为真的条件
 * @param label - 用例描述
 */
function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`[OK] ${label}`);
  } else {
    failed += 1;
    console.error(`[FAIL] ${label}`);
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
    passwordHash: 'm2-ext-test-placeholder',
    nickname: username,
    email: `${username}@m2-ext.test`,
  });
  return Number(result.insertId);
}

/**
 * 创建或复用一条测试路线。
 *
 * @param creatorId - 路线创建者用户 ID
 * @returns 路线 ID
 */
async function ensureTestRoute(creatorId: number): Promise<number> {
  const db = getDb();
  const existing = await db
    .select({ id: travelRoutes.id })
    .from(travelRoutes)
    .where(and(eq(travelRoutes.name, 'M2-ext 测试路线'), eq(travelRoutes.creatorId, creatorId)))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const [result] = await db.insert(travelRoutes).values({
    name: 'M2-ext 测试路线',
    description: 'A-CLOSE-01 验收用路线',
    budgetRange: '3000-8000',
    days: 3,
    interestTags: ['photography'],
    routeDetail: {
      matchedCity: '杭州',
      days: [
        {
          dayIndex: 1,
          attractions: [
            { name: '西湖', time: '09:00', cost: 0, description: '湖光山色' },
            { name: '灵隐寺', time: '14:00', cost: 30, description: '千年古刹' },
          ],
        },
        {
          dayIndex: 2,
          attractions: [
            { name: '千岛湖', time: '08:00', cost: 150, description: '湖岛风光' },
          ],
        },
      ],
    },
    creatorId,
    isPublic: 0,
    status: 1,
  });
  return Number(result.insertId);
}

/**
 * 清理测试用户的需求单数据（不删路线）。
 *
 * @param userId - 测试用户 ID
 */
async function cleanupDemands(userId: number): Promise<void> {
  const db = getDb();
  const demands = await db
    .select({ id: serviceDemand.id })
    .from(serviceDemand)
    .where(eq(serviceDemand.publisherUserId, userId));
  for (const d of demands) {
    await db.delete(serviceDemand).where(eq(serviceDemand.id, d.id));
  }
}

/**
 * 清理测试路线与需求数据。
 *
 * @param userId - 测试用户 ID
 * @param routeId - 测试路线 ID
 */
async function cleanupAll(userId: number, routeId: number): Promise<void> {
  await cleanupDemands(userId);
  const db = getDb();
  await db.delete(travelRoutes).where(eq(travelRoutes.id, routeId));
}

/**
 * 解析预算范围字符串为最小/最大值（与前端逻辑对齐）。
 *
 * @param budgetRange - 预算范围字符串
 * @returns `{ min, max }`；无法解析时 `null`
 */
function parseBudgetRange(budgetRange: string | null): { min: string; max: string } | null {
  if (!budgetRange) return null;
  const parts = budgetRange.split('-').map((s) => s.trim());
  if (parts.length === 2 && parts[0] && parts[1]) return { min: parts[0], max: parts[1] };
  if (parts.length === 1 && parts[0]) return { min: parts[0], max: parts[0] };
  return null;
}

async function main() {
  console.log('--- 准备测试路线 ---');
  const buyerId = await ensureTestUser('m2_ext_buyer');
  const otherId = await ensureTestUser('m2_ext_other');
  const routeId = await ensureTestRoute(buyerId);
  await cleanupDemands(buyerId);
  console.log(`[OK] 路线已就绪 (id=${routeId}, creator=${buyerId})`);

  console.log('\n--- 预算解析 ---');
  const budget = parseBudgetRange('3000-8000');
  assert(budget !== null && budget.min === '3000', '预算下限解析正确');
  assert(budget !== null && budget.max === '8000', '预算上限解析正确');

  console.log('\n--- 带路线发定制需求 ---');
  const leafCategory = SERVICE_CATEGORY_TREE.flatMap((n) => n.children ?? [])[0];
  if (!leafCategory) {
    console.error('[FATAL] 无可用服务类目');
    process.exit(1);
  }

  const draft = await createDemand(buyerId, {
    categoryCode: leafCategory.code,
    title: '按 M2-ext 路线发定制需求',
    description: '已带出路线标题、目的地、预算与关键 POI',
    destination: '杭州',
    budgetMin: '3000',
    budgetMax: '8000',
    budgetType: 'range',
    routeId,
  });
  assert(draft.id > 0, '需求草稿创建成功');
  assert(draft.routeId === routeId, '需求 routeId 回填正确');
  assert(draft.destination === '杭州', '目的地带出正确');
  assert(Number(draft.budgetMin) === 3000, '预算下限写入正确');
  assert(Number(draft.budgetMax) === 8000, '预算上限写入正确');
  assert(draft.publisherType === PublisherType.USER, '发单主体为个人');

  console.log('\n--- 发布需求 ---');
  const published = await publishDemand(draft.id, buyerId);
  assert(published.status === DemandStatus.PUBLISHED, '需求已发布');

  console.log('\n--- 非本人路线 routeId 被拦截 ---');
  try {
    await createDemand(otherId, {
      categoryCode: leafCategory.code,
      title: '盗用他人路线发单',
      routeId,
    });
    assert(false, '非本人路线应被拦截');
  } catch (e) {
    const isApiError = e instanceof ApiError;
    assert(isApiError, '非本人路线抛出 ApiError');
  }

  console.log('\n--- 清理 ---');
  await cleanupAll(buyerId, routeId);
  console.log('[OK] 测试数据已清理');

  console.log('\n--- 结果 ---');
  if (failed > 0) {
    console.error(`M2-ext 路线一键发定制需求验收失败（${failed} 项）`);
    process.exit(1);
  }
  console.log('M2-ext 路线一键发定制需求验收全部通过');
}

main().catch((err) => {
  console.error('验收脚本异常：', err);
  process.exit(1);
});
