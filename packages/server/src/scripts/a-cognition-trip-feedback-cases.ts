/**
 * A-COGNITION-02 · 行程复盘回流验收
 *
 * 验证内容：
 * 1. shared 纯函数：计划 vs 实际 diff、Golden 载荷
 * 2. 预览 API 服务：去过/跳过分类正确
 * 3. finalize：落库 + 写 pet_memories + 规划可召回
 * 4. 二次 finalize 幂等拒绝
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server a-cognition:trip-feedback-cases
 */
import '../config/env.js';
import { eq, sql } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  TripFeedbackStatus,
  assembleTripFeedbackDiff,
  buildTripFeedbackGoldenPayload,
  computeTripFeedbackDiff,
  extractPlannedPoisForFeedback,
  type TravelIntentSnapshot,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { checkIns } from '../db/schema/check-ins.js';
import { petMemories } from '../db/schema/pet-memories.js';
import { tripFeedbacks } from '../db/schema/trip-feedbacks.js';
import { routeComments } from '../db/schema/route-comments.js';
import {
  finalizeTripFeedback,
  previewTripFeedback,
  recallRecentTripFeedbackSummaries,
} from '../services/trip-feedback.service.js';
import {
  applyMemoryContextToIntent,
  injectTripFeedbackSummary,
  type PlanUserContext,
} from '../services/plan-user-context.service.js';

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
    passwordHash: 'trip-feedback-test-placeholder',
    nickname: username,
    email: `${username}@trip-feedback.test`,
    preferredScenes: ['亲子', '美食'],
    ageRange: '25-34',
  });
  return Number(result.insertId);
}

/**
 * 确保记忆表存在（本地库若漏跑 0028 时自愈，CREATE IF NOT EXISTS）。
 */
async function ensurePetMemoryTables(): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`travel_pets\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`user_id\` int NOT NULL,
      \`species\` varchar(32) NOT NULL DEFAULT 'fox',
      \`nickname\` varchar(64) NOT NULL DEFAULT '',
      \`personality\` varchar(32) NOT NULL DEFAULT 'guide',
      \`level\` int NOT NULL DEFAULT 1,
      \`exp\` int NOT NULL DEFAULT 0,
      \`mood\` varchar(16) NOT NULL DEFAULT 'happy',
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_travel_pets_user\` (\`user_id\`)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`pet_memories\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`user_id\` int NOT NULL,
      \`pet_id\` int NULL,
      \`memory_type\` varchar(32) NOT NULL,
      \`content\` text NOT NULL,
      \`metadata\` json NULL,
      \`importance\` tinyint NOT NULL DEFAULT 5,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_pet_memories_user\` (\`user_id\`),
      KEY \`idx_pet_memories_type\` (\`memory_type\`)
    )
  `);
}

/**
 * 清理测试数据。
 *
 * @param userId - 用户 ID
 * @param routeId - 路线 ID
 */
async function cleanup(userId: number, routeId: number | null): Promise<void> {
  const db = getDb();
  if (routeId != null) {
    await db.delete(tripFeedbacks).where(eq(tripFeedbacks.routeId, routeId));
    await db.delete(routeComments).where(eq(routeComments.routeId, routeId));
    await db.delete(checkIns).where(eq(checkIns.routeId, routeId));
    await db.delete(travelRoutes).where(eq(travelRoutes.id, routeId));
  }
  await db.delete(tripFeedbacks).where(eq(tripFeedbacks.userId, userId));
  try {
    await db.delete(petMemories).where(eq(petMemories.userId, userId));
  } catch {
    /* 表尚未创建时忽略 */
  }
}

/**
 * 校验 shared 纯函数。
 */
function checkSharedDiff() {
  console.log('--- shared 复盘纯函数 ---');
  const planned = extractPlannedPoisForFeedback([
    {
      attractions: [
        { name: '西湖', poiType: 'attraction', attractionId: 101 },
        { name: '灵隐寺', poiType: 'attraction' },
        { name: '某酒店', poiType: 'hotel' },
      ],
    },
    {
      attractions: [{ name: '楼外楼', poiType: 'restaurant' }],
    },
  ]);
  assert(planned.length === 3, '提取玩点排除酒店，共 3 个');
  assert(planned[0]?.name === '西湖', '首个玩点为西湖');

  const diff = computeTripFeedbackDiff({
    planned,
    visitedAttractionIds: [101],
    visitedNames: ['楼外楼'],
    ratings: [5, 4],
    reviewTags: ['风景好', '值得去'],
    commentCount: 2,
  });
  assert(diff.visitedCount === 2, '去过 2（西湖 by id + 楼外楼 by name）');
  assert(diff.skippedCount === 1, '跳过 1（灵隐寺）');
  assert(diff.skipped[0]?.name === '灵隐寺', '跳过名为灵隐寺');
  assert(diff.completionRate === 0.67, '完成率 2/3 ≈ 0.67');
  assert(diff.rating.averageRating === 4.5, '均分 4.5');
  assert(diff.summaryText.includes('灵隐寺'), '摘要含跳过景点');

  const assembled = assembleTripFeedbackDiff({
    visited: diff.visited,
    skipped: diff.skipped,
    ratings: [5],
    reviewTags: [],
    commentCount: 1,
  });
  assert(assembled.plannedCount === 3, 'assemble 计划数正确');

  const golden = buildTripFeedbackGoldenPayload({
    routeId: 1,
    userId: 2,
    cityHint: '杭州',
    diff,
    ageRange: '25-34',
    preferredScenes: ['亲子'],
  });
  assert(golden.source === 'trip_feedback', 'Golden source 正确');
  assert(golden.visitedPois.includes('西湖'), 'Golden 含去过');
  assert(golden.skippedPois.includes('灵隐寺'), 'Golden 含跳过');
  console.log('');
}

async function main() {
  checkSharedDiff();

  console.log('--- 准备测试用户与路线 ---');
  await ensurePetMemoryTables();
  const userId = await ensureTestUser('trip_feedback_test_user');
  await cleanup(userId, null);

  const db = getDb();
  await db
    .update(users)
    .set({ preferredScenes: ['亲子', '美食'], ageRange: '25-34' })
    .where(eq(users.id, userId));

  const [routeResult] = await db.insert(travelRoutes).values({
    name: '复盘测试·杭州二日',
    description: 'A-COGNITION-02 验收',
    budgetRange: '2000-5000',
    days: 2,
    interestTags: ['文化', '美食'],
    routeDetail: {
      matchedCity: '杭州',
      days: [
        {
          dayIndex: 1,
          title: '西湖日',
          attractions: [
            {
              name: '西湖',
              time: '09:00',
              cost: 0,
              description: '湖光',
              poiType: 'attraction',
            },
            {
              name: '灵隐寺',
              time: '14:00',
              cost: 30,
              description: '古刹',
              poiType: 'attraction',
            },
          ],
        },
        {
          dayIndex: 2,
          title: '美食日',
          attractions: [
            {
              name: '楼外楼',
              time: '12:00',
              cost: 200,
              description: '杭帮菜',
              poiType: 'restaurant',
            },
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

  await db.insert(checkIns).values({
    userId,
    routeId,
    attractionId: null,
    location: {
      latitude: 30.25,
      longitude: 120.15,
      placeName: '西湖',
    },
    cityCode: '330100',
    pointsEarned: 10,
    status: 1,
  });

  await db.insert(routeComments).values({
    routeId,
    userId,
    content: '西湖很美',
    rating: 5,
    reviewTags: ['风景好'],
  });

  console.log('\n--- 预览 diff ---');
  const preview = await previewTripFeedback(routeId, userId);
  assert(preview.status === TripFeedbackStatus.DRAFT, '预览状态为 draft');
  assert(preview.diff.visitedCount >= 1, '预览至少识别西湖为已到访');
  assert(
    preview.diff.visited.some((v) => v.name === '西湖'),
    '预览去过含西湖',
  );
  assert(
    preview.diff.skipped.some((s) => s.name === '灵隐寺'),
    '预览跳过含灵隐寺',
  );
  assert(preview.goldenPayload?.cityHint === '杭州', 'Golden cityHint=杭州');
  assert(
    preview.diff.rating.averageRating === 5,
    '预览评价均分来自本人评论',
  );

  console.log('\n--- finalize 回流 ---');
  const finalized = await finalizeTripFeedback(routeId, userId, 'zh-CN');
  assert(finalized.status === TripFeedbackStatus.FINALIZED, '已确认');
  assert(finalized.id != null && finalized.id > 0, '已落库 id');
  assert(
    finalized.goldenPayload?.skippedPois.includes('灵隐寺') ?? false,
    'Golden 载荷含跳过',
  );
  assert(finalized.memoryIds.length > 0, '写入至少一条记忆');

  const memories = await db
    .select()
    .from(petMemories)
    .where(eq(petMemories.userId, userId));
  assert(
    memories.some((m) => m.memoryType === 'visited'),
    '含 visited 记忆',
  );
  assert(
    memories.some((m) => m.memoryType === 'regret'),
    '含 regret 记忆（跳过）',
  );
  assert(
    memories.some((m) => m.memoryType === 'trip_summary'),
    '含 trip_summary 记忆',
  );

  console.log('\n--- 规划召回 ---');
  const summaries = await recallRecentTripFeedbackSummaries(userId, 3);
  assert(summaries.length >= 1, '召回至少 1 条复盘摘要');
  assert(summaries[0]?.includes('杭州') ?? false, '摘要含城市');

  const context: PlanUserContext = {
    interestTags: [],
    preferredScenes: [],
    memoryThemes: [],
    excludePoiNames: [],
    boostPoiNames: [],
    personaSummary: null,
    tripFeedbackSummaries: summaries,
  };
  const baseIntent: TravelIntentSnapshot = {
    city: '杭州',
    days: 2,
    budget: '3000',
    budgetMin: null,
    budgetMax: null,
    themes: ['文化'],
    confidence: 'medium',
    transportPreference: null,
    constraintSummary: null,
  };
  const injected = injectTripFeedbackSummary(baseIntent, context);
  assert(
    injected.constraintSummary?.includes('复盘') ?? false,
    'injectTripFeedbackSummary 写入 constraintSummary',
  );
  const applied = applyMemoryContextToIntent(baseIntent, context);
  assert(
    applied.constraintSummary?.includes('复盘') ?? false,
    'applyMemoryContextToIntent 含复盘摘要',
  );

  console.log('\n--- 二次 finalize ---');
  let rejected = false;
  try {
    await finalizeTripFeedback(routeId, userId, 'zh-CN');
  } catch (err) {
    rejected =
      err instanceof ApiError &&
      err.messageKey === ApiMessageKey.TRIP_FEEDBACK_ALREADY_FINALIZED;
  }
  assert(rejected, '已确认后再次 finalize 被拒绝');

  console.log('\n--- 清理 ---');
  await cleanup(userId, routeId);
  console.log('[OK] 测试数据已清理');

  console.log('\n--- 结果 ---');
  if (failed > 0) {
    console.error(`A-COGNITION-02 行程复盘验收失败（${failed} 项）`);
    process.exit(1);
  }
  console.log('A-COGNITION-02 行程复盘验收全部通过');
}

main().catch(async (err) => {
  console.error('验收脚本异常：', err);
  process.exit(1);
});
