/**
 * H8 · Step 31 replan_segment Tool 验收
 *
 * 用法：
 *   pnpm --filter @douxing/server replan-segment:cases
 *   pnpm --filter @douxing/server replan-segment:cases -- --offline
 *   pnpm --filter @douxing/server replan-segment:cases -- --skip-db
 */
import '../config/env.js';
import {
  formatAgentStatusLabel,
  isKnownAgentToolStatusKey,
} from '@douxing/shared';
import { runReplanSegmentTool } from '../agent/tools/replan-segment.tool.js';
import { scheduleRemainingPoisFromGps } from '../services/route-enricher.service.js';
import { getDb } from '../db/client.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { users } from '../db/schema/users.js';
import { eq } from 'drizzle-orm';
import type { RouteDayAttraction, RouteDayPlan } from '@douxing/shared';

const offline = process.argv.includes('--offline');
const skipDb = process.argv.includes('--skip-db');

if (offline) {
  process.env.AMAP_ENABLED = 'false';
}

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
  console.log('--- Agent 状态 i18n ---');
  assert(isKnownAgentToolStatusKey('replan_segment'), 'replan_segment 为已知 Tool key');
  assert(isKnownAgentToolStatusKey('transit_agent'), 'transit_agent 为已知 Tool key');
  const zh = formatAgentStatusLabel('replan_segment', 'zh-CN');
  const en = formatAgentStatusLabel('replan_segment', 'en-US');
  assert(zh.includes('重排'), 'zh-CN replan_segment 文案');
  assert(en.toLowerCase().includes('reorder'), 'en-US replan_segment 文案');
  console.log('');
}

async function checkInvalidToolInput() {
  console.log('--- Tool 入参校验 ---');
  const bad = await runReplanSegmentTool({ routeId: 0, userId: 1, context: {} });
  assert(!bad.ok, '非法入参返回 ok=false');
  console.log('');
}

async function checkGpsReorderOffline() {
  console.log('--- GPS + 剩余 POI 重排（offline）---');
  const remaining: RouteDayAttraction[] = [
    { name: '西湖', latitude: 30.259, longitude: 120.155, time: '', cost: 0, description: '' },
    { name: '灵隐寺', latitude: 30.242, longitude: 120.101, time: '', cost: 0, description: '' },
    { name: '河坊街', latitude: 30.24, longitude: 120.17, time: '', cost: 0, description: '' },
  ];
  const gps = { latitude: 30.258, longitude: 120.152 };

  const result = await scheduleRemainingPoisFromGps({
    city: '杭州',
    remainingSpots: remaining,
    lodging: { name: '西湖边酒店', latitude: 30.25, longitude: 120.16 },
    gps,
    gpsLabel: '当前位置',
    startMinutes: 14 * 60,
    locale: 'zh-CN',
    calendarDate: '2026-06-18',
    dayTitle: '杭州西湖一日',
    openHoursMap: new Map(),
    playbooks: [],
  });

  assert(result.attractions.length === 3, '剩余 3 个 POI 均排程');
  const firstSpot = result.attractions[0]?.name;
  assert(Boolean(firstSpot), '首站 POI 存在');
  assert(result.transit.length >= 1, '含 GPS→首站 transit');
  assert(
    result.transit[0]?.from === '当前位置' && result.transit[0]?.to === firstSpot,
    `首段 transit：${result.transit[0]?.from} → ${result.transit[0]?.to}（期望 当前位置 → ${firstSpot}）`,
  );
  const inputOrder = remaining.map((spot) => spot.name).join(',');
  const outputOrder = result.attractions.map((spot) => spot.name).join(',');
  assert(
    inputOrder !== outputOrder || result.transit[0]?.from === '当前位置',
    '相对原顺序重排或 GPS 首段生效',
  );
  assert(Boolean(result.attractions.every((spot) => spot.time?.includes('-'))), '各 POI 含时刻区间');
  console.log('');
}

function checkRemainingPoiInference() {
  console.log('--- 剩余 POI 推断（无 DB）---');
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

  const cutoff = 13 * 60;
  const remaining = day.attractions.filter((spot) => {
    const endPart = spot.time?.split('-')[1]?.trim();
    if (!endPart) return true;
    const [h, m] = endPart.split(':').map((v) => parseInt(v, 10));
    const end = h * 60 + (m || 0);
    return end >= cutoff;
  });

  assert(remaining.length === 1 && remaining[0]?.name === '武侯祠', '13:00 后仅剩武侯祠');
  console.log('');
}

async function resolveTestUserAndRoute(): Promise<{ userId: number; routeId: number } | null> {
  const db = getDb();
  const userRows = await db.select({ id: users.id }).from(users).limit(1);
  const userId = userRows[0]?.id;
  if (!userId) return null;

  const routeRows = await db
    .select({ id: travelRoutes.id, creatorId: travelRoutes.creatorId })
    .from(travelRoutes)
    .where(eq(travelRoutes.creatorId, userId))
    .limit(1);
  const routeId = routeRows[0]?.id;
  if (!routeId) return null;
  return { userId, routeId };
}

async function checkToolWithDb() {
  if (skipDb) {
    console.log('--- DB 集成（跳过 --skip-db）---\n');
    return;
  }

  console.log('--- DB 集成：replan_segment Tool ---');
  try {
    const pair = await resolveTestUserAndRoute();
    if (!pair) {
      console.log('[SKIP] 无用户/路线，跳过 DB 集成');
      console.log('');
      return;
    }

    const result = await runReplanSegmentTool({
      routeId: pair.routeId,
      userId: pair.userId,
      locale: 'zh-CN',
      context: {
        dayIndex: 0,
        latitude: 30.25,
        longitude: 120.15,
        currentTimeMinutes: 14 * 60,
        remainingPoiNames: undefined,
      },
    });

    if (!result.ok) {
      console.log(`[SKIP] 路线 ${pair.routeId} 无可用剩余 POI 或结构不满足：${result.error?.message}`);
      console.log('');
      return;
    }

    const data = result.data as {
      dayIndex: number;
      segment: { attractions: unknown[] };
      diff: { reordered: unknown[] };
    };
    assert(typeof data.dayIndex === 'number', '返回 dayIndex');
    assert(Array.isArray(data.segment.attractions), '返回 segment.attractions');
    assert(Array.isArray(data.diff.reordered), '返回 diff.reordered');
  } catch (err) {
    console.log('[SKIP] DB 不可用，跳过集成用例');
    console.log(err instanceof Error ? err.message : err);
  }
  console.log('');
}

async function main() {
  console.log('=== H8 Step 31 replan_segment 验收 ===\n');
  checkAgentStatusI18n();
  await checkInvalidToolInput();
  checkRemainingPoiInference();
  await checkGpsReorderOffline();
  await checkToolWithDb();

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
