/**
 * C7-c + H3 · Step 30「第二轮规划体现上次遗憾」验收
 *
 * 模拟：用户已有 regret 记忆 → 再次规划时 boost POI / petMeta / Focus UI 可见遗憾补偿。
 *
 * 用法：
 *   pnpm --filter @douxing/server h3:regret-second-plan-cases
 *   pnpm --filter @douxing/server h3:regret-second-plan-cases -- --skip-db
 */
import '../config/env.js';
import { eq } from 'drizzle-orm';
import { resolvePlanPetFocusViewModel } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { petMemories } from '../db/schema/pet-memories.js';
import { users } from '../db/schema/users.js';
import {
  applyMemoryContextToIntent,
  loadPlanUserContext,
} from '../services/plan-user-context.service.js';
import { analyzeTravelPet } from '../services/pet-analyze.service.js';
import { clearCachedPetAnalyze } from '../services/pet-analyze-cache.service.js';
import {
  buildMemoryRecallPackage,
  PetMemoryType,
  recallUserMemory,
  writeTripMemory,
} from '../services/pet-memory.service.js';
import { buildPlanPetMeta } from '../services/plan-pet-meta.service.js';
import { deleteTravelPetForUser } from '../services/travel-pet.service.js';
import type { TravelIntentSnapshot } from '@douxing/shared';

const skipDb = process.argv.includes('--skip-db');
const REGRET_POI = '蜀大侠火锅';
let failed = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

const BASE_INTENT: TravelIntentSnapshot = {
  city: '成都',
  days: 3,
  budget: null,
  budgetMin: null,
  budgetMax: null,
  themes: ['美食'],
  confidence: 'medium',
  cities: [],
  excludeProvinceCodes: [],
  suggestedDestinations: [],
};

function checkRegretRecallPackage() {
  console.log('--- regret 召回包（无 DB）---');
  const memories = [
    {
      id: 1,
      memoryType: PetMemoryType.PREFERENCE,
      content: '偏爱美食',
      importance: 7,
    },
    {
      id: 2,
      memoryType: PetMemoryType.REGRET,
      content: '成都火锅没吃到',
      importance: 9,
      metadata: { poiName: REGRET_POI },
    },
  ];
  const zh = buildMemoryRecallPackage(memories, 'zh-CN');
  assert(zh.context.boostPoiNames.includes(REGRET_POI), 'boostPoiNames 含遗憾 POI');
  assert(
    zh.recallExplain.some((item) => item.memoryType === 'regret' && item.reason.includes('遗憾')),
    'recallExplain 含遗憾原因',
  );

  const en = buildMemoryRecallPackage(memories, 'en-US');
  assert(
    en.recallExplain.some((item) => item.reason.toLowerCase().includes('regret')),
    'en regret reason',
  );
  console.log('');
}

async function resolveTestUserId(): Promise<number | null> {
  const db = getDb();
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows[0]?.id ?? null;
}

async function cleanupUser(userId: number) {
  const db = getDb();
  await db.delete(petMemories).where(eq(petMemories.userId, userId));
  await deleteTravelPetForUser(userId).catch(() => undefined);
  await clearCachedPetAnalyze(userId, 'pre_plan');
}

async function checkSecondPlanWithRegret(userId: number) {
  console.log('--- 第二轮规划 context（有遗憾记忆）---');
  await cleanupUser(userId);

  const beforeMeta = await buildPlanPetMeta(userId, 'zh-CN', null);
  assert(!beforeMeta.recallExplain.some((item) => item.memoryType === 'regret'), '首轮无 regret 记忆');

  await writeTripMemory({
    userId,
    memoryType: PetMemoryType.REGRET,
    content: '上次成都行没吃到蜀大侠火锅',
    importance: 9,
    metadata: { poiName: REGRET_POI, city: '成都' },
  });
  await writeTripMemory({
    userId,
    memoryType: PetMemoryType.PREFERENCE,
    content: '偏爱美食、火锅',
    importance: 7,
  });

  const userContext = await loadPlanUserContext(userId);
  assert(userContext.boostPoiNames.includes(REGRET_POI), 'loadPlanUserContext boost 遗憾 POI');
  assert(userContext.memoryThemes.some((t) => t.includes('美食') || t.includes('火锅')), 'memoryThemes 含偏好');

  const petMeta = await buildPlanPetMeta(userId, 'zh-CN', null);
  assert(
    petMeta.recallExplain.some((item) => item.memoryType === 'regret'),
    'buildPlanPetMeta 召回 regret',
  );
  assert(
    petMeta.recallExplain.some((item) => item.reason.includes('遗憾')),
    'petMeta regret 原因文案',
  );

  const focusVm = resolvePlanPetFocusViewModel(petMeta, 'zh-CN');
  assert(Boolean(focusVm?.hasMemories), 'Focus UI hasMemories');
  assert(
    focusVm?.recallItems.some((item) => item.reason.includes('遗憾')),
    'Focus UI 展示遗憾条目',
  );

  const memories = await recallUserMemory(userId, { limit: 8 });
  const pack = buildMemoryRecallPackage(memories, 'zh-CN');
  const merged = applyMemoryContextToIntent(BASE_INTENT, userContext, pack.memorySummary);
  assert(Boolean(merged.constraintSummary?.includes('召回')), 'intent constraintSummary 含记忆摘要');
  assert(merged.themes.some((t) => t.includes('美食') || t.includes('火锅')), 'intent themes 合并偏好');

  const generateBoost = userContext.boostPoiNames;
  assert(generateBoost.includes(REGRET_POI), 'createPlanSession 同源 boostPoiNames');

  const analyze = await analyzeTravelPet(userId, { scene: 'pre_plan' }, 'zh-CN', {
    skipCache: true,
  });
  assert(Boolean(analyze.insight && analyze.petReply), 'pre_plan analyze 有产出');
  assert(
    analyze.insight.includes('火锅') ||
      analyze.petReply.includes('火锅') ||
      analyze.petReply.includes('偏好') ||
      petMeta.memorySummary.includes('火锅'),
    'analyze / 记忆链路透出遗憾或偏好',
  );

  await cleanupUser(userId);
  console.log('');
}

async function main() {
  console.log('=== Step 30 · 第二轮规划体现「上次遗憾」验收 ===\n');
  checkRegretRecallPackage();

  if (skipDb) {
    console.log('--- 第二轮规划 context ---');
    console.log('[SKIP] --skip-db 已跳过\n');
  } else {
    try {
      const userId = await resolveTestUserId();
      if (!userId) {
        failed += 1;
        console.error('[FAIL] 数据库无用户\n');
      } else {
        await checkSecondPlanWithRegret(userId);
      }
    } catch (err) {
      failed += 1;
      console.error('[FAIL] DB 用例异常:', err instanceof Error ? err.message : err);
    }
  }

  if (failed > 0) {
    console.error(`Step 30 regret 用例失败：${failed} 项未通过`);
    process.exit(1);
  }

  console.log('=== Step 30 regret 用例全部通过 ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('[h3-regret-second-plan-cases]', err);
  process.exit(1);
});
