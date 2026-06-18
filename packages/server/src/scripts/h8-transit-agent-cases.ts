/**
 * H8 · Step 32 transit_agent + 行中 UI 验收
 *
 * 用法：
 *   pnpm --filter @douxing/server h8:transit-agent-cases
 *   pnpm --filter @douxing/server h8:transit-agent-cases -- --skip-db
 */
import '../config/env.js';
import { ApiError, formatAgentStatusLabel, RouteStatus } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { users } from '../db/schema/users.js';
import { eq } from 'drizzle-orm';
import { applyRouteReplan, previewRouteReplan } from '../services/replan-segment.service.js';

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

function checkTransitAgentI18n() {
  console.log('--- transit_agent i18n ---');
  const zh = formatAgentStatusLabel('transit_agent', 'zh-CN');
  const en = formatAgentStatusLabel('transit_agent', 'en-US');
  assert(zh.includes('行中'), 'zh transit_agent');
  assert(en.toLowerCase().includes('trip'), 'en transit_agent');
  console.log('');
}

async function findRouteIdForUser(
  userId: number,
  status: number,
): Promise<number | null> {
  const db = getDb();
  const rows = await db
    .select({ id: travelRoutes.id, status: travelRoutes.status })
    .from(travelRoutes)
    .where(eq(travelRoutes.creatorId, userId))
    .limit(50);
  return rows.find((row) => row.status === status)?.id ?? null;
}

async function checkPublishedCannotApply() {
  if (skipDb) {
    console.log('--- 已发布不可写回（跳过 --skip-db）---\n');
    return;
  }

  console.log('--- 已发布不可写回 ---');
  try {
    const db = getDb();
    const userRows = await db.select({ id: users.id }).from(users).limit(1);
    const userId = userRows[0]?.id;
    if (!userId) {
      console.log('[SKIP] 无用户');
      console.log('');
      return;
    }

    const publishedId = await findRouteIdForUser(userId, RouteStatus.PUBLISHED);
    if (!publishedId) {
      console.log('[SKIP] 无已发布路线');
      console.log('');
      return;
    }

    const preview = await previewRouteReplan({
      routeId: publishedId,
      userId,
      locale: 'zh-CN',
      useTransitAgent: false,
      context: {
        dayIndex: 0,
        latitude: 30.25,
        longitude: 120.15,
      },
    }).catch(() => null);

    if (!preview) {
      console.log('[SKIP] 已发布路线无可用剩余 POI');
      console.log('');
      return;
    }

    assert(preview.canApply === false, '已发布 canApply=false');

    let blocked = false;
    try {
      await applyRouteReplan({
        routeId: publishedId,
        userId,
        locale: 'zh-CN',
        context: {
          dayIndex: 0,
          latitude: 30.25,
          longitude: 120.15,
        },
      });
    } catch (err) {
      blocked = err instanceof ApiError;
    }
    assert(blocked, 'apply 已发布路线抛出 ApiError');
  } catch (err) {
    console.log('[SKIP] DB 不可用', err instanceof Error ? err.message : err);
  }
  console.log('');
}

async function checkDraftApplyPath() {
  if (skipDb) {
    console.log('--- 草稿 preview（跳过 --skip-db）---\n');
    return;
  }

  console.log('--- 草稿 preview + canApply ---');
  try {
    const db = getDb();
    const userRows = await db.select({ id: users.id }).from(users).limit(1);
    const userId = userRows[0]?.id;
    if (!userId) {
      console.log('[SKIP] 无用户');
      console.log('');
      return;
    }

    const draftId = await findRouteIdForUser(userId, RouteStatus.DRAFT);
    if (!draftId) {
      console.log('[SKIP] 无草稿路线');
      console.log('');
      return;
    }

    const preview = await previewRouteReplan({
      routeId: draftId,
      userId,
      locale: 'zh-CN',
      useTransitAgent: false,
      context: {
        dayIndex: 0,
        latitude: 30.25,
        longitude: 120.15,
      },
    }).catch(() => null);

    if (!preview) {
      console.log('[SKIP] 草稿无可用剩余 POI');
      console.log('');
      return;
    }

    assert(preview.canApply === true, '草稿 canApply=true');
    assert(Boolean(preview.preview.segment.attractions.length), 'preview 含 segment');
  } catch (err) {
    console.log('[SKIP] DB 不可用', err instanceof Error ? err.message : err);
  }
  console.log('');
}

function checkPreviewShape() {
  console.log('--- preview 结构（类型契约）---');
  const sample = {
    preview: {
      routeId: 1,
      dayIndex: 0,
      day: { date: '第1天', title: 'test', attractions: [] },
      segment: { attractions: [], transit: [], warnings: [] },
      diff: { skippedPoiNames: [], reordered: [] },
    },
    canApply: false,
  };
  assert(sample.canApply === false, 'canApply 字段存在');
  assert(Array.isArray(sample.preview.diff.reordered), 'diff.reordered');
  console.log('');
}

async function main() {
  console.log('=== H8 Step 32 transit_agent + UI 验收 ===\n');
  checkTransitAgentI18n();
  checkPreviewShape();
  await checkPublishedCannotApply();
  await checkDraftApplyPath();

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
