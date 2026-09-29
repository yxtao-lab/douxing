/**
 * U4 · 验证积分与打卡奖励验收
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server u4:verification-points-cases
 */
import '../config/env.js';
import { eq, inArray, sql } from 'drizzle-orm';
import {
  CheckInStatus,
  RouteContentTier,
  RouteSourceKind,
  RouteVerificationStatus,
  VERIFICATION_POINT_AMOUNTS,
  VerificationPointEventType,
  computeCheckInVerificationAward,
  extractRouteKeyAttractionIds,
  resolveFollowCompleteThreshold,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { checkIns } from '../db/schema/check-ins.js';
import { attractions } from '../db/schema/attractions.js';
import { verificationPointEvents } from '../db/schema/verification-point-events.js';
import { createInspirationRoute } from '../services/route.service.js';
import { recomputeRouteTrust } from '../services/route-trust.service.js';
import {
  awardCheckInVerification,
  awardCorrectionAccepted,
  getVerificationPointsBalance,
  hasCheckInVerificationForPoi,
  listVerificationPointEvents,
  maybeAwardFollowComplete,
} from '../services/verification-points.service.js';

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
 * 按账本重算用户验证积分余额（测试清理用）。
 *
 * @param userId - 用户 ID
 */
async function resyncUserBalance(userId: number) {
  const db = getDb();
  const sumRows = await db
    .select({
      total: sql<number>`coalesce(sum(${verificationPointEvents.points}), 0)`,
    })
    .from(verificationPointEvents)
    .where(eq(verificationPointEvents.userId, userId));
  await db
    .update(users)
    .set({ verificationPoints: Number(sumRows[0]?.total ?? 0) })
    .where(eq(users.id, userId));
}

/**
 * 校验 shared 打卡验证分公式与同点防刷。
 */
function checkSharedHelpers() {
  console.log('--- shared 验证积分 ---');
  const keys = extractRouteKeyAttractionIds({
    days: [
      {
        attractions: [
          { name: 'A', attractionId: 1 },
          { name: 'B', attractionId: 2 },
          { name: 'C', attractionId: 3 },
        ],
      },
    ],
  });
  assert(keys.length === 2 && keys[0] === 1 && keys[1] === 3, '关键节点取每天首尾绑定 POI');
  assert(resolveFollowCompleteThreshold(keys.length) === 2, '跟走门槛=2');

  const first = computeCheckInVerificationAward({
    isFirstAtAttraction: true,
    isKeyNode: true,
    hasPhotos: true,
    alreadyAwardedForPoi: false,
  });
  assert(
    first.total ===
      VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.CHECKIN_KEY_NODE] +
        VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.CHECKIN_FIRST_POI] +
        VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.CHECKIN_QUALITY],
    '首次关键节点带图合计正确',
  );

  const dup = computeCheckInVerificationAward({
    isFirstAtAttraction: true,
    isKeyNode: true,
    hasPhotos: true,
    alreadyAwardedForPoi: true,
  });
  assert(dup.total === 0 && dup.skippedDuplicatePoi, '同点已入账 → 0 分');
  console.log('');
}

/**
 * 校验迁移字段与账本表存在。
 */
async function checkColumns() {
  console.log('--- 表结构 ---');
  const db = getDb();
  const userCols = await db
    .select({ verificationPoints: users.verificationPoints })
    .from(users)
    .limit(1);
  assert(
    userCols[0] != null && typeof userCols[0].verificationPoints === 'number',
    'users.verification_points 可读',
  );

  const eventCols = await db
    .select({ id: verificationPointEvents.id, dedupeKey: verificationPointEvents.dedupeKey })
    .from(verificationPointEvents)
    .limit(1);
  assert(Array.isArray(eventCols), 'verification_point_events 可读');
  console.log('');
}

/**
 * 端到端：上传低分、同点不刷、纠错、跟走、可出行升级。
 */
async function checkLedgerFlow() {
  console.log('--- 账本入账 ---');
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
  assert(attractionRows.length >= 2, '景点库至少 2 条可用于关键节点');
  if (attractionRows.length < 2) return;
  const poiA = attractionRows[0]!.id;
  const poiB = attractionRows[1]!.id;

  const routeDetail = {
    days: [
      {
        date: '2026-09-28',
        title: 'Day 1',
        attractions: [
          {
            name: attractionRows[0]!.name,
            attractionId: poiA,
            time: '09:00',
            cost: 0,
            description: '关键节点 A',
          },
          {
            name: attractionRows[1]!.name,
            attractionId: poiB,
            time: '14:00',
            cost: 0,
            description: '关键节点 B',
          },
        ],
      },
    ],
  };

  const beforeDemo = await getVerificationPointsBalance(demoUserId);
  const route = await createInspirationRoute(demoUserId, {
    name: `U4验证积分-${Date.now()}`,
    description: 'U4 验收灵感稿，结构化天数与绑定 POI，描述足够长用于质量维度。',
    days: 1,
    interestTags: [],
    sceneTags: [],
    sourceKind: RouteSourceKind.UGC_ORIGINAL,
    routeDetail,
  });

  const afterPublish = await getVerificationPointsBalance(demoUserId);
  assert(
    afterPublish - beforeDemo ===
      VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.INSPIRATION_PUBLISH],
    '发布灵感稿入账低分',
  );

  const againPublish = await createInspirationRoute(demoUserId, {
    name: `U4验证积分-第二条-${Date.now()}`,
    description: '另一条灵感稿',
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
            {
              name: attractionRows[0]!.name,
              attractionId: poiA,
              time: '10:00',
              cost: 0,
              description: '单点',
            },
          ],
        },
      ],
    },
  });
  const afterSecond = await getVerificationPointsBalance(demoUserId);
  assert(
    afterSecond - afterPublish ===
      VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.INSPIRATION_PUBLISH],
    '另一条灵感稿可再得上传分',
  );

  const [ci1] = await db.insert(checkIns).values({
    userId: adminUserId,
    routeId: route.id,
    attractionId: poiA,
    location: { latitude: 30.25, longitude: 120.15 },
    cityCode: '330100',
    photos: ['u4-test.jpg'],
    pointsEarned: 0,
    status: CheckInStatus.APPROVED,
  });
  const checkInId1 = Number(ci1.insertId);

  const award1 = await awardCheckInVerification({
    userId: adminUserId,
    routeId: route.id,
    checkInId: checkInId1,
    attractionId: poiA,
    isFirstAtAttraction: true,
    hasPhotos: true,
    routeDetail,
  });
  assert(award1.creditedPoints > 0, '首次关键节点打卡入账 > 0');
  assert(await hasCheckInVerificationForPoi(adminUserId, route.id, poiA), '同点已标记入账');

  const award2 = await awardCheckInVerification({
    userId: adminUserId,
    routeId: route.id,
    checkInId: checkInId1,
    attractionId: poiA,
    isFirstAtAttraction: false,
    hasPhotos: true,
    routeDetail,
  });
  assert(award2.creditedPoints === 0 && award2.award.skippedDuplicatePoi, '同点再刷不加分');

  const beforeAuthor = await getVerificationPointsBalance(demoUserId);
  const [ci2] = await db.insert(checkIns).values({
    userId: adminUserId,
    routeId: route.id,
    attractionId: poiB,
    location: { latitude: 30.26, longitude: 120.16 },
    cityCode: '330100',
    status: CheckInStatus.APPROVED,
  });
  await awardCheckInVerification({
    userId: adminUserId,
    routeId: route.id,
    checkInId: Number(ci2.insertId),
    attractionId: poiB,
    isFirstAtAttraction: true,
    hasPhotos: false,
    routeDetail,
  });
  const follow = await maybeAwardFollowComplete(route.id, adminUserId);
  assert(follow?.credited === true, '他人跟走完成给作者高分');
  const afterAuthor = await getVerificationPointsBalance(demoUserId);
  assert(
    afterAuthor - beforeAuthor ===
      VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.FOLLOW_COMPLETE],
    '跟走完成分值正确',
  );

  const beforeCorrection = await getVerificationPointsBalance(adminUserId);
  const correction = await awardCorrectionAccepted(adminUserId, route.id, `u4-report-${route.id}`);
  assert(correction.credited, '纠错采纳入账');
  const correctionAgain = await awardCorrectionAccepted(
    adminUserId,
    route.id,
    `u4-report-${route.id}`,
  );
  assert(!correctionAgain.credited, '纠错采纳幂等');
  assert(
    (await getVerificationPointsBalance(adminUserId)) - beforeCorrection ===
      VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.CORRECTION_ACCEPTED],
    '纠错采纳分值正确',
  );

  await db
    .update(travelRoutes)
    .set({
      verificationStatus: RouteVerificationStatus.VERIFIED,
      sourceKind: RouteSourceKind.UGC_ORIGINAL,
      trustCrowned: 0,
    })
    .where(eq(travelRoutes.id, route.id));

  await db.insert(checkIns).values({
    userId: demoUserId,
    routeId: route.id,
    attractionId: poiA,
    location: { latitude: 30.25, longitude: 120.15 },
    cityCode: '330100',
    status: CheckInStatus.APPROVED,
  });

  const beforeUpgrade = await getVerificationPointsBalance(demoUserId);
  await recomputeRouteTrust(route.id);
  const routeRow = await db
    .select({ contentTier: travelRoutes.contentTier })
    .from(travelRoutes)
    .where(eq(travelRoutes.id, route.id))
    .limit(1);
  assert(routeRow[0]?.contentTier === RouteContentTier.TRAVEL_READY, '样例升级为 travel_ready');
  const afterUpgrade = await getVerificationPointsBalance(demoUserId);
  assert(
    afterUpgrade - beforeUpgrade ===
      VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.TRAVEL_READY_UPGRADE],
    '可出行升级一次性高分',
  );
  await recomputeRouteTrust(route.id);
  assert(
    (await getVerificationPointsBalance(demoUserId)) === afterUpgrade,
    '可出行升级幂等不重复入账',
  );

  const summary = await listVerificationPointEvents(demoUserId, 1, 50);
  assert(summary.balance === afterUpgrade, '账本摘要余额与账户一致');
  assert(summary.events.length > 0, '账本可审计列出事件');
  assert(
    summary.events.some((e) => e.eventType === VerificationPointEventType.INSPIRATION_PUBLISH),
    '账本含上传事件',
  );

  const routeIds = [route.id, againPublish.id];
  await db.delete(verificationPointEvents).where(inArray(verificationPointEvents.routeId, routeIds));
  await db.delete(checkIns).where(inArray(checkIns.routeId, routeIds));
  await db.delete(travelRoutes).where(inArray(travelRoutes.id, routeIds));
  await resyncUserBalance(demoUserId);
  await resyncUserBalance(adminUserId);

  console.log('');
}

async function main() {
  console.log('=== U4 验证积分与打卡奖励验收 ===\n');
  checkSharedHelpers();
  await checkColumns();
  await checkLedgerFlow();

  if (failed > 0) {
    console.error(`\nU4 验收失败：${failed} 项未通过`);
    process.exit(1);
  }
  console.log('\nU4 验收通过');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
