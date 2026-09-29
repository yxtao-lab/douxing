/**
 * U5 · 反作弊与过期降权验收
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server u5:anti-abuse-cases
 */
import '../config/env.js';
import { eq, inArray } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  CheckInStatus,
  RouteContentTier,
  RouteModerationAction,
  RouteReportReason,
  RouteReportStatus,
  RouteSourceKind,
  RouteVerificationStatus,
  ROUTE_STALE_DAYS,
  ROUTE_TRUST_OPEN_REPORT_PENALTY,
  ROUTE_TRUST_OPEN_REPORT_PENALTY_CAP,
  ROUTE_TRUST_STALE_PENALTY,
  UGC_RATE_LIMITS,
  VERIFICATION_POINT_AMOUNTS,
  VerificationPointEventType,
  computeOpenReportPenalty,
  computeRouteTrust,
  isRouteStale,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { attractions } from '../db/schema/attractions.js';
import { checkIns } from '../db/schema/check-ins.js';
import { routeReports } from '../db/schema/route-reports.js';
import { verificationPointEvents } from '../db/schema/verification-point-events.js';
import { createInspirationRoute } from '../services/route.service.js';
import {
  acceptRouteReport,
  createRouteReport,
  rejectRouteReport,
} from '../services/route-report.service.js';
import {
  applyRouteModerationAction,
  recomputeRouteTrust,
} from '../services/route-trust.service.js';
import {
  assertUgcRateLimit,
  clearUgcRateLimitMemoryForTests,
} from '../services/ugc-rate-limit.service.js';
import { getVerificationPointsBalance } from '../services/verification-points.service.js';

let failed = 0;

/**
 * 断言条件为真，失败时累计失败计数并打印标签。
 *
 * @param condition - 期望为真的条件
 * @param label - 用例描述
 */
function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

/**
 * 校验 shared 过期/报错扣分与频控常量。
 */
function checkSharedHelpers() {
  console.log('--- shared 反作弊 ---');
  assert(UGC_RATE_LIMITS.LIKE_PER_HOUR === 30, '点赞频控=30/时');
  assert(UGC_RATE_LIMITS.COMMENT_PER_HOUR === 10, '评论频控=10/时');
  assert(UGC_RATE_LIMITS.REPORT_PER_DAY === 5, '报错频控=5/天');
  assert(UGC_RATE_LIMITS.CHECKIN_PER_DAY === 20, '打卡频控=20/天');
  assert(ROUTE_STALE_DAYS === 90, '过期天数=90');

  const now = Date.now();
  assert(!isRouteStale(now - 10 * 24 * 3600 * 1000, now), '10 天内不过期');
  assert(isRouteStale(now - 91 * 24 * 3600 * 1000, now), '91 天过期');

  assert(computeOpenReportPenalty(0) === 0, '0 条报错无扣分');
  assert(computeOpenReportPenalty(1) === ROUTE_TRUST_OPEN_REPORT_PENALTY, '1 条报错扣分');
  assert(
    computeOpenReportPenalty(10) === ROUTE_TRUST_OPEN_REPORT_PENALTY_CAP,
    '报错扣分有上限',
  );

  const stale = computeRouteTrust({
    uniqueCheckInUsers: 2,
    updatedAtMs: now - 100 * 24 * 3600 * 1000,
    nowMs: now,
    verificationStatus: RouteVerificationStatus.VERIFIED,
    sourceKind: RouteSourceKind.UGC_ORIGINAL,
    forkCount: 0,
    structuredDayCount: 1,
    poiCount: 2,
    boundPoiCount: 2,
    hasDescription: true,
    openReportCount: 2,
  });
  assert(stale.breakdown.reasonKeys.includes('stale'), '拆解含过期');
  assert(stale.breakdown.reasonKeys.includes('open_reports'), '拆解含未结案报错');
  assert(stale.breakdown.penalty >= ROUTE_TRUST_STALE_PENALTY, '过期扣分计入 penalty');

  const demoted = computeRouteTrust({
    uniqueCheckInUsers: 5,
    updatedAtMs: now,
    nowMs: now,
    verificationStatus: RouteVerificationStatus.VERIFIED,
    sourceKind: RouteSourceKind.UGC_ORIGINAL,
    forkCount: 0,
    structuredDayCount: 2,
    poiCount: 4,
    boundPoiCount: 4,
    hasDescription: true,
    trustCrowned: true,
    forceInspiration: true,
  });
  assert(
    demoted.contentTier === RouteContentTier.INSPIRATION,
    'forceInspiration 强制灵感稿（即使加冕）',
  );
  console.log('');
}

/**
 * 校验迁移字段与报错表存在。
 */
async function checkColumns() {
  console.log('--- 表结构 ---');
  const db = getDb();
  try {
    await db
      .select({ trustDemoted: travelRoutes.trustDemoted, trustScore: travelRoutes.trustScore })
      .from(travelRoutes)
      .limit(1);
    assert(true, 'travel_routes.trust_demoted 可读');
  } catch (err) {
    assert(false, `trust_demoted 可读: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    await db.select({ id: routeReports.id }).from(routeReports).limit(1);
    assert(true, 'route_reports 可读');
  } catch (err) {
    assert(false, `route_reports 可读: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log('');
}

/**
 * 校验内存频控：达上限后抛错且不继续消耗。
 */
async function checkRateLimit() {
  console.log('--- 频控 ---');
  clearUgcRateLimitMemoryForTests();
  const userId = 9_000_001;
  const limit = 3;
  const windowSec = 60;
  for (let i = 0; i < limit; i += 1) {
    await assertUgcRateLimit(userId, 'u5-test', limit, windowSec);
  }
  let blocked = false;
  try {
    await assertUgcRateLimit(userId, 'u5-test', limit, windowSec);
  } catch (err) {
    blocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.UGC_RATE_LIMITED;
  }
  assert(blocked, '超限抛 UGC_RATE_LIMITED');
  clearUgcRateLimitMemoryForTests();
  await assertUgcRateLimit(userId, 'u5-test', limit, windowSec);
  assert(true, '清空内存桶后可再操作');
  clearUgcRateLimitMemoryForTests();
  console.log('');
}

/**
 * 端到端：报错降权、采纳积分、过期、运营处置。
 */
async function checkReportAndModeration() {
  console.log('--- 报错 / 过期 / 处置 ---');
  const db = getDb();
  const demo = await db.select().from(users).where(eq(users.username, 'demo')).limit(1);
  const admin = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);
  const demoUserId = demo[0]?.id;
  const adminUserId = admin[0]?.id;
  assert(demoUserId != null && adminUserId != null, '存在 demo/admin 用户');
  if (demoUserId == null || adminUserId == null) return;

  const attractionRows = await db
    .select({ id: attractions.id, name: attractions.name })
    .from(attractions)
    .limit(2);
  assert(attractionRows.length >= 2, '景点库至少 2 条');
  if (attractionRows.length < 2) return;
  const poiA = attractionRows[0]!.id;
  const poiB = attractionRows[1]!.id;

  const stamp = Date.now();
  const route = await createInspirationRoute(demoUserId, {
    name: `U5反作弊-${stamp}`,
    description: '结构完整可出行样例',
    days: 1,
    interestTags: [],
    sceneTags: [],
    sourceKind: RouteSourceKind.UGC_ORIGINAL,
    routeDetail: {
      days: [
        {
          date: '2026-09-28',
          title: 'Day 1',
          attractions: [
            { name: attractionRows[0]!.name, attractionId: poiA, time: '09:00', cost: 0 },
            { name: attractionRows[1]!.name, attractionId: poiB, time: '14:00', cost: 0 },
          ],
        },
      ],
    },
  });

  await db
    .update(travelRoutes)
    .set({
      verificationStatus: RouteVerificationStatus.VERIFIED,
      trustDemoted: 0,
      trustCrowned: 0,
      description: '结构完整可出行样例',
    })
    .where(eq(travelRoutes.id, route.id));

  await db.insert(checkIns).values({
    userId: adminUserId,
    routeId: route.id,
    attractionId: poiA,
    location: { latitude: 30.25, longitude: 120.15 },
    cityCode: '330100',
    status: CheckInStatus.APPROVED,
  });
  await db.insert(checkIns).values({
    userId: demoUserId,
    routeId: route.id,
    attractionId: poiB,
    location: { latitude: 30.26, longitude: 120.16 },
    cityCode: '330100',
    status: CheckInStatus.APPROVED,
  });

  await recomputeRouteTrust(route.id);
  let row = (
    await db.select().from(travelRoutes).where(eq(travelRoutes.id, route.id)).limit(1)
  )[0]!;
  assert(row.contentTier === RouteContentTier.TRAVEL_READY, '基线升级为 travel_ready');
  const baselineScore = row.trustScore ?? 0;

  clearUgcRateLimitMemoryForTests();
  const report = await createRouteReport(route.id, adminUserId, {
    reason: RouteReportReason.OUTDATED,
    detail: '景点已关闭',
  });
  assert(report.status === RouteReportStatus.OPEN, '报错工单 open');

  let dupBlocked = false;
  try {
    await createRouteReport(route.id, adminUserId, {
      reason: RouteReportReason.OUTDATED,
      detail: '重复',
    });
  } catch (err) {
    dupBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.ROUTE_REPORT_DUPLICATE;
  }
  assert(dupBlocked, '同因重复报错被拒');

  let selfBlocked = false;
  try {
    await createRouteReport(route.id, demoUserId, {
      reason: RouteReportReason.OTHER,
      detail: '自举报',
    });
  } catch (err) {
    selfBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.ROUTE_REPORT_SELF_FORBIDDEN;
  }
  assert(selfBlocked, '不能举报自己的路线');

  row = (await db.select().from(travelRoutes).where(eq(travelRoutes.id, route.id)).limit(1))[0]!;
  assert((row.trustScore ?? 0) < baselineScore, '未结案报错降低可信分');
  const breakdown = row.trustBreakdown as { reasonKeys?: string[] } | null;
  assert(
    Array.isArray(breakdown?.reasonKeys) && breakdown!.reasonKeys!.includes('open_reports'),
    'trustBreakdown 含 open_reports',
  );

  await db
    .update(travelRoutes)
    .set({
      updatedAt: new Date(Date.now() - (ROUTE_STALE_DAYS + 5) * 24 * 3600 * 1000),
    })
    .where(eq(travelRoutes.id, route.id));
  await recomputeRouteTrust(route.id);
  row = (await db.select().from(travelRoutes).where(eq(travelRoutes.id, route.id)).limit(1))[0]!;
  const staleBreakdown = row.trustBreakdown as { reasonKeys?: string[] } | null;
  assert(
    Array.isArray(staleBreakdown?.reasonKeys) && staleBreakdown!.reasonKeys!.includes('stale'),
    '过期后 trustBreakdown 含 stale',
  );

  const beforeAccept = await getVerificationPointsBalance(adminUserId);
  const accepted = await acceptRouteReport(report.id, demoUserId, '已核实过期');
  assert(accepted.status === RouteReportStatus.ACCEPTED, '采纳状态 accepted');
  const afterAccept = await getVerificationPointsBalance(adminUserId);
  assert(
    afterAccept - beforeAccept ===
      VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.CORRECTION_ACCEPTED],
    '采纳报错给举报人验证积分',
  );
  row = (await db.select().from(travelRoutes).where(eq(travelRoutes.id, route.id)).limit(1))[0]!;
  assert(
    row.verificationStatus === RouteVerificationStatus.PENDING,
    '过期类采纳后路线回待核验',
  );

  clearUgcRateLimitMemoryForTests();
  const report2 = await createRouteReport(route.id, adminUserId, {
    reason: RouteReportReason.DANGEROUS,
    detail: '路段危险',
  });
  await rejectRouteReport(report2.id, demoUserId, '误报');
  const rejected = (
    await db.select().from(routeReports).where(eq(routeReports.id, report2.id)).limit(1)
  )[0]!;
  assert(rejected.status === RouteReportStatus.REJECTED, '驳回状态 rejected');

  await applyRouteModerationAction(route.id, RouteModerationAction.DEMOTE);
  row = (await db.select().from(travelRoutes).where(eq(travelRoutes.id, route.id)).limit(1))[0]!;
  assert(row.trustDemoted === 1, '降级写入 trust_demoted');
  assert(row.contentTier === RouteContentTier.INSPIRATION, '降级后强制 inspiration');
  assert(row.trustCrowned === 0, '降级清除加冕');

  await db
    .update(travelRoutes)
    .set({
      verificationStatus: RouteVerificationStatus.VERIFIED,
      updatedAt: new Date(),
    })
    .where(eq(travelRoutes.id, route.id));
  await recomputeRouteTrust(route.id);
  row = (await db.select().from(travelRoutes).where(eq(travelRoutes.id, route.id)).limit(1))[0]!;
  assert(
    row.contentTier === RouteContentTier.INSPIRATION,
    'trust_demoted 阻止重算回升可出行',
  );

  await applyRouteModerationAction(route.id, RouteModerationAction.RESTORE);
  row = (await db.select().from(travelRoutes).where(eq(travelRoutes.id, route.id)).limit(1))[0]!;
  assert(row.trustDemoted === 0, '恢复清除 trust_demoted');
  assert(row.isPublic === 1, '恢复后公开');

  await applyRouteModerationAction(route.id, RouteModerationAction.HIDE);
  row = (await db.select().from(travelRoutes).where(eq(travelRoutes.id, route.id)).limit(1))[0]!;
  assert(row.isPublic === 0, '隐藏后不下广场');

  await applyRouteModerationAction(route.id, RouteModerationAction.RESTORE);

  const routeIds = [route.id];
  await db.delete(verificationPointEvents).where(inArray(verificationPointEvents.routeId, routeIds));
  await db.delete(routeReports).where(inArray(routeReports.routeId, routeIds));
  await db.delete(checkIns).where(inArray(checkIns.routeId, routeIds));
  await db.delete(travelRoutes).where(inArray(travelRoutes.id, routeIds));

  console.log('');
}

async function main() {
  console.log('=== U5 反作弊与过期降权验收 ===\n');
  checkSharedHelpers();
  await checkColumns();
  await checkRateLimit();
  await checkReportAndModeration();

  if (failed > 0) {
    console.error(`\nU5 验收失败：${failed} 项未通过`);
    process.exit(1);
  }
  console.log('\nU5 验收通过');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
