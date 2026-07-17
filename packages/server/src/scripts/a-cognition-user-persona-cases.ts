/**
 * A-COGNITION-01 · 统一用户旅行画像验收
 *
 * 验证内容：
 * 1. 无数据用户画像默认值正确
 * 2. 有路线/打卡/兴趣标签后画像派生字段正确
 * 3. 画像摘要可读
 * 4. 刷新后 personaVersion 递增
 * 5. 规划注入函数 injectPersonaSummary 正确写入 constraintSummary
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server a-cognition:user-persona-cases
 */
import '../config/env.js';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { checkIns } from '../db/schema/check-ins.js';
import { userTravelPersona } from '../db/schema/user-travel-persona.js';
import {
  buildUserPersona,
  getUserPersona,
  refreshUserPersona,
} from '../services/travel-persona.service.js';
import {
  injectPersonaSummary,
  type PlanUserContext,
} from '../services/plan-user-context.service.js';
import type { TravelIntentSnapshot } from '@douxing/shared';

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
    passwordHash: 'persona-test-placeholder',
    nickname: username,
    email: `${username}@persona.test`,
  });
  return Number(result.insertId);
}

/**
 * 清理测试用户画像与关联数据。
 *
 * @param userId - 测试用户 ID
 * @param routeIds - 测试路线 ID 列表
 */
async function cleanup(userId: number, routeIds: number[]): Promise<void> {
  const db = getDb();
  await db.delete(userTravelPersona).where(eq(userTravelPersona.userId, userId));
  for (const rid of routeIds) {
    await db.delete(checkIns).where(eq(checkIns.routeId, rid));
    await db.delete(travelRoutes).where(eq(travelRoutes.id, rid));
  }
  await db.delete(travelRoutes).where(eq(travelRoutes.creatorId, userId));
  await db.update(users).set({ interestTags: null }).where(eq(users.id, userId));
}

async function main() {
  console.log('--- 准备测试用户 ---');
  const userId = await ensureTestUser('persona_test_user');
  await cleanup(userId, []);
  console.log(`[OK] 用户已就绪 (id=${userId})`);

  console.log('\n--- 空数据用户画像 ---');
  const emptyPersona = await buildUserPersona(userId);
  assert(emptyPersona.rhythm === 'balanced', '空用户节奏默认 balanced');
  assert(emptyPersona.budgetTier === 'mid-range', '空用户预算档次默认 mid-range');
  assert(emptyPersona.routeCount === 0, '空用户路线数为 0');
  assert(emptyPersona.checkinCount === 0, '空用户打卡数为 0');
  assert(emptyPersona.companionStructure?.includes('solo') ?? false, '空用户同伴结构默认 solo');
  assert(emptyPersona.interestTags.length === 0, '空用户兴趣标签为空');

  console.log('\n--- 设置兴趣标签与路线 ---');
  const db = getDb();
  await db
    .update(users)
    .set({ interestTags: ['文化', '美食', '亲子'] })
    .where(eq(users.id, userId));

  const [routeResult] = await db.insert(travelRoutes).values({
    name: '画像测试路线·杭州三日',
    description: 'A-COGNITION-01 验收',
    budgetRange: '3000-8000',
    days: 3,
    interestTags: ['文化', '美食'],
    routeDetail: {
      matchedCity: '杭州',
      days: [
        {
          dayIndex: 1,
          attractions: [
            { name: '西湖', time: '09:00', cost: 0, description: '湖光山色', poiType: 'attraction' },
            { name: '灵隐寺', time: '14:00', cost: 30, description: '古刹', poiType: 'attraction' },
          ],
        },
        {
          dayIndex: 2,
          attractions: [
            { name: '楼外楼', time: '12:00', cost: 200, description: '杭帮菜', poiType: 'restaurant' },
          ],
        },
      ],
    },
    creatorId: userId,
    isPublic: 0,
    status: 1,
  });
  const routeId = Number(routeResult.insertId);
  console.log(`[OK] 路线已创建 (id=${routeId})`);

  console.log('\n--- 有数据用户画像 ---');
  const persona = await buildUserPersona(userId);
  assert(persona.routeCount === 1, '路线数 = 1');
  assert(persona.interestTags.includes('文化'), '兴趣标签含「文化」');
  assert(persona.interestTags.includes('亲子'), '兴趣标签含「亲子」');
  assert(
    persona.companionStructure?.includes('family') ?? false,
    '有亲子标签 → 同伴结构含 family',
  );
  assert(persona.topDestinations?.includes('杭州') ?? false, '偏好目的地含杭州');
  assert(persona.budgetTier === 'budget', '日均预算 ~1833 → budget');
  assert(persona.travelStyle != null && persona.travelStyle.includes('亲子'), '旅行风格含亲子');
  assert(persona.summary != null && persona.summary.length > 0, '画像摘要非空');
  assert(
    persona.summary?.includes('旅行风格') ?? false,
    '摘要含「旅行风格」字段',
  );
  assert(
    persona.summary?.includes('偏好目的地') ?? false,
    '摘要含「偏好目的地」字段',
  );

  console.log('\n--- 画像持久化与读取 ---');
  const cached = await getUserPersona(userId);
  assert(cached !== null, 'getUserPersona 返回非空');
  assert(cached?.userId === userId, '缓存画像 userId 正确');
  assert(cached?.travelStyle === persona.travelStyle, '缓存画像 travelStyle 一致');

  console.log('\n--- 画像刷新 ---');
  const refreshed = await refreshUserPersona(userId);
  assert(refreshed !== null, 'refreshUserPersona 返回非空');
  assert(
    (refreshed?.personaVersion ?? 0) > (cached?.personaVersion ?? 0),
    '刷新后 personaVersion 递增',
  );

  console.log('\n--- 规划注入 ---');
  const context: PlanUserContext = {
    interestTags: persona.interestTags,
    preferredScenes: [],
    memoryThemes: [],
    excludePoiNames: [],
    boostPoiNames: [],
    personaSummary: persona.summary,
  };
  const baseIntent: TravelIntentSnapshot = {
    destination: '杭州',
    days: 3,
    budget: '5000',
    themes: ['文化'],
    transportPreference: null,
    constraintSummary: null,
    dailyBudget: null,
    startDate: null,
    endDate: null,
    headcount: null,
  };
  const injected = injectPersonaSummary(baseIntent, context);
  assert(
    injected.constraintSummary != null && injected.constraintSummary.length > 0,
    'injectPersonaSummary 写入 constraintSummary',
  );
  assert(
    injected.constraintSummary?.includes('旅行风格') ?? false,
    'constraintSummary 含画像摘要内容',
  );

  const nullContext: PlanUserContext = {
    interestTags: [],
    preferredScenes: [],
    memoryThemes: [],
    excludePoiNames: [],
    boostPoiNames: [],
    personaSummary: null,
  };
  const notInjected = injectPersonaSummary(baseIntent, nullContext);
  assert(
    notInjected.constraintSummary === null,
    'personaSummary 为 null 时不注入',
  );

  console.log('\n--- 清理 ---');
  await cleanup(userId, [routeId]);
  console.log('[OK] 测试数据已清理');

  console.log('\n--- 结果 ---');
  if (failed > 0) {
    console.error(`A-COGNITION-01 旅行画像验收失败（${failed} 项）`);
    process.exit(1);
  }
  console.log('A-COGNITION-01 旅行画像验收全部通过');
}

main().catch((err) => {
  console.error('验收脚本异常：', err);
  process.exit(1);
});
