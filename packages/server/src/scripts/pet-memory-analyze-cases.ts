/**
 * H3-c · Step 29 记忆墙 / analyze API 验收
 *
 * 用法：
 *   pnpm --filter @douxing/server pet:memory-analyze-cases
 *   pnpm --filter @douxing/server pet:memory-analyze-cases -- --skip-db
 */
import '../config/env.js';
import {
  ApiMessageKey,
  buildPetMemoryWallListItemViewModel,
  formatPetAnalyzeSceneLabel,
  formatPetMemoryTypeLabel,
  isPetAnalyzeScene,
  resolveApiMessage,
  resolveTravelPetAmbientBubble,
  type PetAnalyzeResult,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { petMemories } from '../db/schema/pet-memories.js';
import { eq } from 'drizzle-orm';
import {
  PetMemoryType,
  deleteUserMemory,
  listUserMemoriesPaginated,
  setUserMemoryPinned,
  writeTripMemory,
  confirmSuggestedMemories,
} from '../services/pet-memory.service.js';
import { analyzeTravelPet } from '../services/pet-analyze.service.js';
import { clearCachedPetAnalyze } from '../services/pet-analyze-cache.service.js';
import { deleteTravelPetForUser } from '../services/travel-pet.service.js';

const skipDb = process.argv.includes('--skip-db');
let failed = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

function checkSharedHelpers() {
  console.log('--- 共享 ViewModel / i18n ---');
  assert(isPetAnalyzeScene('pre_plan'), 'pre_plan 合法场景');
  assert(isPetAnalyzeScene('in_trip'), 'in_trip 合法场景');
  assert(isPetAnalyzeScene('in_plan'), 'in_plan 合法场景');
  assert(formatPetAnalyzeSceneLabel('in_trip', 'zh-CN').length > 0, 'in_trip 场景标签 zh-CN');

  const vm = buildPetMemoryWallListItemViewModel(
    {
      id: 1,
      memoryType: 'preference',
      content: '偏爱火锅',
      importance: 8,
      pinned: true,
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
    },
    'zh-CN',
  );
  assert(vm.typeLabel.length > 0 && vm.pinned === true, '记忆墙 ViewModel');

  const analyze: PetAnalyzeResult = {
    scene: 'pre_plan',
    insight: '测试洞察',
    petReply: '「小兜」：记得你偏爱火锅',
    suggestedActions: [],
    memoriesToSave: [],
    cached: true,
    analyzedAt: new Date().toISOString(),
  };
  const bubble = resolveTravelPetAmbientBubble(
    { nickname: '小兜', personality: 'foodie', mood: 'happy' },
    null,
    'zh-CN',
    analyze,
  );
  assert(bubble.includes('火锅'), '气泡优先读 analyze 缓存 petReply');
  console.log('');
}

function checkApiI18n() {
  console.log('--- API i18n ---');
  const keys = [
    ApiMessageKey.PET_MEMORY_DELETE_SUCCESS,
    ApiMessageKey.PET_MEMORY_SAVE_SUCCESS,
    ApiMessageKey.PET_ANALYZE_FAILED,
    ApiMessageKey.PET_ANALYZE_INVALID_SCENE,
  ] as const;
  for (const key of keys) {
    assert(resolveApiMessage(key, 'zh-CN').length > 0, `zh-CN ${key}`);
    assert(resolveApiMessage(key, 'en-US').length > 0, `en-US ${key}`);
  }
  console.log('');
}

async function cleanupUserMemories(userId: number) {
  const db = getDb();
  await db.delete(petMemories).where(eq(petMemories.userId, userId));
  await deleteTravelPetForUser(userId).catch(() => undefined);
  await clearCachedPetAnalyze(userId, 'pre_plan');
  await clearCachedPetAnalyze(userId, 'on_demand');
}

async function checkMemoryWallCrud(userId: number) {
  console.log('--- 记忆墙 CRUD ---');
  await cleanupUserMemories(userId);

  const id1 = await writeTripMemory({
    userId,
    memoryType: PetMemoryType.PREFERENCE,
    content: '偏爱慢节奏',
    importance: 8,
  });
  const id2 = await writeTripMemory({
    userId,
    memoryType: PetMemoryType.TRIP_SUMMARY,
    content: '杭州三日游摘要',
    importance: 6,
  });
  assert(Boolean(id1 && id2), '写入两条记忆');

  const page1 = await listUserMemoriesPaginated(userId, 1, 10);
  assert(page1.total >= 2 && page1.items.length >= 2, '分页可读');

  const pinned = await setUserMemoryPinned(userId, id2!, true);
  assert(pinned.pinned === true, '可置顶');

  const page2 = await listUserMemoriesPaginated(userId, 1, 10);
  assert(page2.items[0]?.id === id2, '置顶排前');

  await deleteUserMemory(userId, id1!);
  const page3 = await listUserMemoriesPaginated(userId, 1, 10);
  assert(page3.total === 1, '删除后 total 减一');
  console.log('');
}

async function checkAnalyze(userId: number) {
  console.log('--- analyze API ---');
  await cleanupUserMemories(userId);
  await writeTripMemory({
    userId,
    memoryType: PetMemoryType.PREFERENCE,
    content: '偏爱美食',
    importance: 7,
  });

  const prePlan = await analyzeTravelPet(userId, { scene: 'pre_plan' }, 'zh-CN', {
    skipCache: true,
  });
  assert(Boolean(prePlan.insight && prePlan.petReply), 'pre_plan 产出 insight + petReply');

  const cached = await analyzeTravelPet(userId, { scene: 'pre_plan' }, 'zh-CN');
  assert(cached.cached === true, '第二次读缓存');

  const onDemand = await analyzeTravelPet(userId, { scene: 'on_demand' }, 'en-US', {
    skipCache: true,
  });
  assert(onDemand.scene === 'on_demand', 'on_demand 场景');

  const savedIds = await confirmSuggestedMemories(userId, [
    { memoryType: PetMemoryType.PREFERENCE, content: '测试确认写入', importance: 5 },
  ]);
  assert(savedIds.length === 1, '确认写入记忆');
  console.log('');
}

async function resolveTestUserId(): Promise<number | null> {
  const db = getDb();
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows[0]?.id ?? null;
}

async function main() {
  console.log('=== H3-c 记忆墙 / analyze 验收（Step 29）===\n');
  checkSharedHelpers();
  checkApiI18n();

  if (skipDb) {
    console.log('--- DB 用例 ---');
    console.log('[SKIP] --skip-db 已跳过\n');
  } else {
    try {
      const userId = await resolveTestUserId();
      if (!userId) {
        failed += 1;
        console.error('[FAIL] 数据库无用户\n');
      } else {
        await checkMemoryWallCrud(userId);
        await checkAnalyze(userId);
        await cleanupUserMemories(userId);
      }
    } catch (err) {
      failed += 1;
      console.error('[FAIL] DB 用例异常:', err instanceof Error ? err.message : err);
    }
  }

  if (failed > 0) {
    console.error(`Step 29 验收失败：${failed} 项未通过`);
    process.exit(1);
  }

  console.log('=== Step 29 验收全部通过 ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('[pet-memory-analyze-cases]', err);
  process.exit(1);
});
