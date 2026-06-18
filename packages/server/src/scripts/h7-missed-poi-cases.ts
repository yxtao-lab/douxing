/**
 * H7 · Step 33 错过景点补救验收
 *
 * 用法：
 *   pnpm --filter @douxing/server h7:missed-poi-cases
 *   pnpm --filter @douxing/server h7:missed-poi-cases -- --skip-db
 */
import '../config/env.js';
import {
  formatAgentStatusLabel,
  isKnownAgentToolStatusKey,
  type CheckInInfo,
  type RouteDayPlan,
} from '@douxing/shared';
import { eq } from 'drizzle-orm';
import { runDetectMissedPoisTool } from '../agent/tools/detect-missed-pois.tool.js';
import { getDb } from '../db/client.js';
import { petMemories } from '../db/schema/pet-memories.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { users } from '../db/schema/users.js';
import {
  buildVisitMatchContext,
  collectMissedPoisForDays,
  isPlannedPoiVisited,
  analyzeRouteMissedPois,
  recordMissedPoiRegrets,
} from '../services/missed-poi.service.js';
import {
  PetMemoryType,
  recallUserMemory,
} from '../services/pet-memory.service.js';

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

function checkAgentStatusI18n() {
  console.log('--- detect_missed_pois i18n ---');
  assert(isKnownAgentToolStatusKey('detect_missed_pois'), 'detect_missed_pois 为已知 Tool key');
  const zh = formatAgentStatusLabel('detect_missed_pois', 'zh-CN');
  const en = formatAgentStatusLabel('detect_missed_pois', 'en-US');
  assert(zh.includes('遗漏'), 'zh detect_missed_pois');
  assert(en.toLowerCase().includes('missed'), 'en detect_missed_pois');
  console.log('');
}

function checkMissedDetectionOffline() {
  console.log('--- 应到未到推断（无 DB）---');
  const day: RouteDayPlan = {
    date: '第 1 天',
    title: '成都美食',
    attractions: [
      { name: '宽窄巷子', time: '09:00-10:30', cost: 0, description: '' },
      { name: '锦里', time: '11:00-12:30', cost: 0, description: '' },
      { name: '武侯祠', time: '14:00-15:30', cost: 0, description: '' },
    ],
    lodging: { name: '春熙路酒店' },
  };

  const checkIns: CheckInInfo[] = [
    {
      id: 1,
      userId: 1,
      routeId: 1,
      attractionId: null,
      location: { placeName: '宽窄巷子', latitude: 30.67, longitude: 104.05 },
      cityCode: '510100',
      photos: [],
      pointsEarned: 10,
      checkedAt: new Date().toISOString(),
      status: 1,
      remark: null,
    },
  ];

  const visitCtx = buildVisitMatchContext(checkIns);
  assert(isPlannedPoiVisited(day.attractions[0]!, visitCtx), '宽窄巷子已打卡');
  assert(!isPlannedPoiVisited(day.attractions[1]!, visitCtx), '锦里未打卡');

  const missed = collectMissedPoisForDays([day], 0, 13 * 60, visitCtx);
  assert(missed.length === 1 && missed[0]?.name === '锦里', '13:00 应遗漏锦里');
  assert(missed.every((m) => m.reason === 'scheduled_past'), '当日遗漏 reason=scheduled_past');
  console.log('');
}

function checkPastDayMissedOffline() {
  console.log('--- 往日遗漏（无 DB）---');
  const days: RouteDayPlan[] = [
    {
      date: '第 1 天',
      title: '杭州',
      attractions: [
        { name: '西湖', time: '09:00-11:00', cost: 0, description: '' },
        { name: '灵隐寺', time: '14:00-16:00', cost: 0, description: '' },
      ],
      lodging: { name: '西湖酒店' },
    },
    {
      date: '第 2 天',
      title: '杭州',
      attractions: [{ name: '河坊街', time: '10:00-12:00', cost: 0, description: '' }],
      lodging: { name: '西湖酒店' },
    },
  ];

  const visitCtx = buildVisitMatchContext([]);
  const missed = collectMissedPoisForDays(days, 1, 13 * 60, visitCtx);
  assert(missed.length === 3, '两天均未打卡应 3 个遗漏');
  assert(missed.some((m) => m.name === '西湖' && m.reason === 'past_day'), '第 1 天西湖 past_day');
  console.log('');
}

async function checkInvalidToolInput() {
  console.log('--- Tool 入参校验 ---');
  const bad = await runDetectMissedPoisTool({ routeId: 0, userId: 1, dayIndex: -1 });
  assert(!bad.ok, '非法入参返回 ok=false');
  console.log('');
}

async function resolveTestUserAndRoute(): Promise<{ userId: number; routeId: number } | null> {
  const db = getDb();
  const userRows = await db.select({ id: users.id }).from(users).limit(1);
  const userId = userRows[0]?.id;
  if (!userId) return null;

  const routeRows = await db
    .select({ id: travelRoutes.id })
    .from(travelRoutes)
    .where(eq(travelRoutes.creatorId, userId))
    .limit(1);
  const routeId = routeRows[0]?.id;
  if (!routeId) return null;
  return { userId, routeId };
}

async function checkDbIntegration() {
  if (skipDb) {
    console.log('--- DB 集成（跳过 --skip-db）---\n');
    return;
  }

  console.log('--- DB 集成：analyze + record regret ---');
  try {
    const pair = await resolveTestUserAndRoute();
    if (!pair) {
      console.log('[SKIP] 无用户/路线');
      console.log('');
      return;
    }

    const db = getDb();
    await db.delete(petMemories).where(eq(petMemories.userId, pair.userId));

    const analyze = await analyzeRouteMissedPois({
      routeId: pair.routeId,
      userId: pair.userId,
      dayIndex: 0,
      currentTimeMinutes: 20 * 60,
      locale: 'zh-CN',
    });
    assert(Array.isArray(analyze.missed), 'analyze 返回 missed 数组');
    assert(Array.isArray(analyze.alternatives), 'analyze 返回 alternatives 数组');

    const sampleName = analyze.missed[0]?.name ?? '测试遗漏景点';
    const record = await recordMissedPoiRegrets({
      routeId: pair.routeId,
      userId: pair.userId,
      locale: 'zh-CN',
      items: [{ name: sampleName, dayIndex: 0 }],
    });
    assert(record.memoryIds.length >= 1, 'record 写入 regret 记忆');

    const duplicate = await recordMissedPoiRegrets({
      routeId: pair.routeId,
      userId: pair.userId,
      locale: 'zh-CN',
      items: [{ name: sampleName, dayIndex: 0 }],
    });
    assert(duplicate.skipped.includes(sampleName), '重复写入应 skipped');

    const memories = await recallUserMemory(pair.userId, {
      types: [PetMemoryType.REGRET],
      limit: 5,
    });
    assert(memories.some((m) => m.metadata?.source === 'h7_missed_poi'), 'recall 含 h7 来源 regret');

    const tool = await runDetectMissedPoisTool({
      routeId: pair.routeId,
      userId: pair.userId,
      dayIndex: 0,
      currentTimeMinutes: 20 * 60,
      locale: 'zh-CN',
    });
    assert(tool.ok, 'detect_missed_pois Tool 成功');
  } catch (err) {
    failed += 1;
    console.error('[FAIL] DB 集成异常:', err);
  }
  console.log('');
}

async function main() {
  console.log('H7 missed-poi cases\n');
  checkAgentStatusI18n();
  checkMissedDetectionOffline();
  checkPastDayMissedOffline();
  await checkInvalidToolInput();
  await checkDbIntegration();

  if (failed > 0) {
    console.error(`\n${failed} 项失败`);
    process.exit(1);
  }
  console.log('\n全部通过');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
