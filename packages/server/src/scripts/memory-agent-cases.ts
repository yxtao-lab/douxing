/**
 * C7-c · Step 26 memory_agent 验收
 *
 * 用法：
 *   pnpm --filter @douxing/server memory-agent:cases
 *   pnpm --filter @douxing/server memory-agent:cases -- --skip-db
 */
import '../config/env.js';
import {
  formatAgentStatusLabel,
  isKnownAgentToolStatusKey,
} from '@douxing/shared';
import type { TravelIntentSnapshot } from '@douxing/shared';
import { runApplyMemoryContextTool } from '../agent/tools/apply-memory-context.tool.js';
import { runRecallUserMemoryTool } from '../agent/tools/memory.tools.js';
import {
  applyMemoryContextToIntent,
  loadPlanUserContext,
} from '../services/plan-user-context.service.js';
import {
  buildMemoryRecallExplain,
  buildMemoryRecallPackage,
  PetMemoryType,
  type RecalledMemory,
  writeTripMemory,
} from '../services/pet-memory.service.js';
import { deleteTravelPetForUser } from '../services/travel-pet.service.js';
import { getDb } from '../db/client.js';
import { petMemories } from '../db/schema/pet-memories.js';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema/users.js';

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

const SAMPLE_MEMORIES: RecalledMemory[] = [
  {
    id: 1,
    memoryType: PetMemoryType.PREFERENCE,
    content: '偏爱美食、慢节奏',
    importance: 8,
  },
  {
    id: 2,
    memoryType: PetMemoryType.REGRET,
    content: '成都火锅没吃到',
    importance: 9,
    metadata: { poiName: '蜀大侠火锅' },
  },
];

function checkExplainableRecall() {
  console.log('--- 可解释召回 ---');
  const zh = buildMemoryRecallExplain(SAMPLE_MEMORIES, 'zh-CN');
  assert(zh.recallExplain.length === 2, 'recallExplain 条数');
  assert(zh.recallExplain[1]?.reason.includes('遗憾'), 'zh regret reason');
  assert(zh.memorySummary.includes('召回'), 'zh memorySummary');

  const en = buildMemoryRecallExplain(SAMPLE_MEMORIES, 'en-US');
  assert(en.recallExplain[0]?.reason.includes('preference'), 'en preference reason');
  assert(en.memorySummary.includes('Recalled'), 'en memorySummary');

  const pack = buildMemoryRecallPackage(SAMPLE_MEMORIES, 'zh-CN');
  assert(pack.context.boostPoiNames.includes('蜀大侠火锅'), 'boost POI 来自 regret');
  assert(pack.context.memoryThemes.includes('偏爱美食'), 'themes 来自 preference');
  console.log('');
}

function checkIntentInjection() {
  console.log('--- 注入 plan context ---');
  const intent: TravelIntentSnapshot = {
    city: '成都',
    days: 3,
    budget: null,
    budgetMin: null,
    budgetMax: null,
    themes: ['自然'],
    confidence: 'medium',
    cities: [],
    excludeProvinceCodes: [],
    suggestedDestinations: [],
  };
  const context = {
    interestTags: ['摄影'],
    memoryThemes: ['偏爱美食'],
    excludePoiNames: ['武侯祠'],
    boostPoiNames: ['蜀大侠火锅'],
  };
  const merged = applyMemoryContextToIntent(intent, context, '召回 2 条记忆：· 偏爱美食');
  assert(merged.themes.includes('摄影'), '合并 interestTags');
  assert(merged.themes.includes('偏爱美食'), '合并 memoryThemes');
  assert(Boolean(merged.constraintSummary?.includes('召回 2 条记忆')), '写入 constraintSummary');
  console.log('');
}

function checkAgentStatusI18n() {
  console.log('--- Agent SSE i18n ---');
  for (const tool of ['memory_agent', 'apply_memory_context'] as const) {
    assert(isKnownAgentToolStatusKey(tool), `known tool ${tool}`);
    const zh = formatAgentStatusLabel(tool, 'zh-CN');
    const en = formatAgentStatusLabel(tool, 'en-US');
    assert(zh.length > 0 && !zh.startsWith('agent.status'), `zh ${tool}`);
    assert(en.length > 0 && !en.startsWith('agent.status'), `en ${tool}`);
  }
  console.log('');
}

async function resolveTestUserId(): Promise<number | null> {
  const db = getDb();
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows[0]?.id ?? null;
}

async function cleanupUserMemories(userId: number) {
  const db = getDb();
  await db.delete(petMemories).where(eq(petMemories.userId, userId));
  await deleteTravelPetForUser(userId).catch(() => undefined);
}

async function checkToolChain(userId: number) {
  console.log('--- Tool 链（recall → apply）---');
  await cleanupUserMemories(userId);
  await writeTripMemory({
    userId,
    memoryType: PetMemoryType.REGRET,
    content: '上次没吃到火锅',
    importance: 8,
    metadata: { poiName: '宽窄巷子' },
  });

  const recall = await runRecallUserMemoryTool({
    userId,
    limit: 5,
    locale: 'zh-CN',
  });
  assert(recall.ok, 'recall_user_memory ok');
  if (!recall.ok) return;

  assert(Boolean(recall.data.memorySummary), 'recall 含 memorySummary');
  assert(Array.isArray(recall.data.recallExplain), 'recall 含 recallExplain');

  const baseIntent: TravelIntentSnapshot = {
    city: '成都',
    days: 2,
    budget: null,
    budgetMin: null,
    budgetMax: null,
    themes: [],
    confidence: 'low',
    cities: [],
    excludeProvinceCodes: [],
    suggestedDestinations: [],
  };

  const applied = await runApplyMemoryContextTool({
    intent: baseIntent,
    userId,
    memorySummary: recall.data.memorySummary,
    context: recall.data.context,
  });
  assert(applied.ok, 'apply_memory_context ok');
  if (!applied.ok) return;

  const merged = applied.data.intent;
  assert((merged.constraintSummary?.length ?? 0) > 0, 'apply 写入 constraintSummary');

  const ctx = await loadPlanUserContext(userId);
  assert(ctx.boostPoiNames.length > 0, 'loadPlanUserContext boost POI');

  await cleanupUserMemories(userId);
  console.log('');
}

async function main() {
  console.log('=== C7-c memory_agent 验收（Step 26）===\n');
  checkExplainableRecall();
  checkIntentInjection();
  checkAgentStatusI18n();

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
        await checkToolChain(userId);
      }
    } catch (err) {
      failed += 1;
      console.error('[FAIL] DB 用例异常:', err instanceof Error ? err.message : err);
    }
  }

  if (failed > 0) {
    console.error(`Step 26 验收失败：${failed} 项未通过`);
    process.exit(1);
  }

  console.log('=== Step 26 验收全部通过 ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('[memory-agent-cases] 运行失败:', err);
  process.exit(1);
});
