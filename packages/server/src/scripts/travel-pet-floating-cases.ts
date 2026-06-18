/**
 * H3-b · Step 28 全站悬浮层验收（共享 ViewModel + 后端 floating-context 逻辑）
 *
 * 用法：
 *   pnpm --filter @douxing/server travel-pet-floating:cases
 *   pnpm --filter @douxing/server travel-pet-floating:cases -- --skip-db
 */
import '../config/env.js';
import {
  isPetCompanionVisibleEnabled,
  resolveTravelPetAmbientBubble,
  resolveTravelPetFloatingSheetViewModel,
  resolveTravelPetSpeciesEmoji,
  type PlanPetMeta,
  type TravelPetInfo,
} from '@douxing/shared';
import { buildPlanPetMeta } from '../services/plan-pet-meta.service.js';
import {
  deleteTravelPetForUser,
  getTravelPetFloatingContext,
} from '../services/travel-pet.service.js';
import { writeTripMemory, PetMemoryType } from '../services/pet-memory.service.js';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { petMemories } from '../db/schema/pet-memories.js';
import { eq } from 'drizzle-orm';

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

function checkSharedViewModel() {
  console.log('--- 共享 ViewModel ---');
  assert(resolveTravelPetSpeciesEmoji('fox') === '🦊', 'species emoji fox');
  assert(isPetCompanionVisibleEnabled(null) === true, '默认开启简洁模式开关');
  assert(isPetCompanionVisibleEnabled('false') === false, '可关闭浮层');

  const pet: TravelPetInfo = {
    id: 1,
    species: 'cat',
    nickname: '团子',
    personality: 'foodie',
    level: 3,
    exp: 120,
    mood: 'happy',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const meta: PlanPetMeta = {
    nickname: '团子',
    species: 'cat',
    personality: 'foodie',
    memorySummary: '召回 1 条记忆',
    recallExplain: [{ memoryType: 'preference', content: '偏爱火锅', reason: '稳定偏好' }],
  };
  const bubble = resolveTravelPetAmbientBubble(pet, meta, 'zh-CN');
  assert(Boolean(bubble.includes('火锅')), 'ambient 含记忆 hint');

  const sheet = resolveTravelPetFloatingSheetViewModel(pet, meta, 'zh-CN');
  assert(sheet.speciesEmoji === '🐱', 'sheet emoji');
  assert(sheet.hasMemories === true, 'sheet hasMemories');
  assert(Boolean(sheet.goPlanLabel.length), 'goPlan label');
  assert(Boolean(sheet.viewMemoryWallLabel.length), 'viewMemoryWall label');
  assert(Boolean(sheet.analyzePrePlanLabel.length), 'analyzePrePlan label');
  console.log('');
}

async function resolveTestUserId(): Promise<number | null> {
  const envId = process.env.PET_FLOATING_CASE_USER_ID;
  if (envId) {
    const parsed = Number(envId);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const db = getDb();
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows[0]?.id ?? null;
}

async function cleanupUser(userId: number) {
  const db = getDb();
  await db.delete(petMemories).where(eq(petMemories.userId, userId));
  await deleteTravelPetForUser(userId).catch(() => undefined);
}

async function checkFloatingContextOrchestrator(userId: number) {
  console.log('--- floating-context 与 orchestrator 同源 ---');
  await cleanupUser(userId);
  await writeTripMemory({
    userId,
    memoryType: PetMemoryType.PREFERENCE,
    content: '偏爱慢节奏',
    importance: 8,
  });

  const ctx = await getTravelPetFloatingContext(userId, 'zh-CN');
  assert(Boolean(ctx?.pet.nickname), 'lazy pet');
  assert(Boolean(ctx?.petMeta.nickname), 'petMeta nickname');

  const directMeta = await buildPlanPetMeta(userId, 'zh-CN', null);
  assert(
    ctx?.petMeta.memorySummary === directMeta.memorySummary,
    'petMeta 与 buildPlanPetMeta 一致',
  );
  assert(
    (ctx?.petMeta.recallExplain.length ?? 0) === directMeta.recallExplain.length,
    'recallExplain 条数一致',
  );
  console.log('');
}

async function main() {
  console.log('=== H3-b 全站悬浮层验收（Step 28）===\n');
  checkSharedViewModel();

  if (skipDb) {
    console.log('--- floating-context 与 orchestrator 同源 ---');
    console.log('[SKIP] --skip-db 已跳过\n');
  } else {
    try {
      const userId = await resolveTestUserId();
      if (!userId) {
        failed += 1;
        console.error('[FAIL] 数据库无用户，无法跑 DB 用例\n');
      } else {
        await checkFloatingContextOrchestrator(userId);
        await cleanupUser(userId);
      }
    } catch (err) {
      failed += 1;
      console.error('[FAIL] DB 用例异常:', err instanceof Error ? err.message : err);
      console.error('提示：需 MySQL 可用；无 DB 时使用 --skip-db\n');
    }
  }

  if (failed > 0) {
    console.error(`Step 28 验收失败：${failed} 项未通过`);
    process.exit(1);
  }

  console.log('=== Step 28 验收全部通过 ===');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
