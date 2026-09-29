/**
 * U3 · 可信分层与主推荐验收
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server u3:trust-recommend-cases
 */
import '../config/env.js';
import { eq, inArray } from 'drizzle-orm';
import {
  CheckInStatus,
  computeRouteHeatScore,
  computeRouteTrust,
  extractRouteQualitySignals,
  isCrawlUnverifiedForTravelReady,
  RouteContentTier,
  RouteSourceKind,
  RouteVerificationStatus,
  ROUTE_TRAVEL_READY_THRESHOLD,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { checkIns } from '../db/schema/check-ins.js';
import { createInspirationRoute } from '../services/route.service.js';
import { recomputeRouteTrust } from '../services/route-trust.service.js';
import { listRoutesForUser } from '../services/route-interaction.service.js';

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
 * 校验可信度公式与热度分互不混用。
 */
function checkSharedHelpers() {
  console.log('--- shared 可信度 ---');
  const quality = extractRouteQualitySignals(
    {
      days: [
        {
          attractions: [
            { name: '西湖', attractionId: 1 },
            { name: '断桥', attractionId: 2 },
          ],
        },
      ],
    },
    '周末短途',
  );
  assert(quality.structuredDayCount === 1, '结构化天数');
  assert(quality.poiCount === 2 && quality.boundPoiCount === 2, 'POI 绑定内容库');

  const ready = computeRouteTrust({
    uniqueCheckInUsers: 2,
    updatedAtMs: Date.now(),
    nowMs: Date.now(),
    verificationStatus: RouteVerificationStatus.VERIFIED,
    sourceKind: RouteSourceKind.UGC_ORIGINAL,
    forkCount: 0,
    ...quality,
  });
  assert(ready.score >= ROUTE_TRAVEL_READY_THRESHOLD, '履约+质量达到可出行门槛');
  assert(ready.contentTier === RouteContentTier.TRAVEL_READY, '达到门槛 → travel_ready');
  assert(ready.breakdown.reasonKeys.includes('fulfillment'), '拆解含履约');
  assert(ready.breakdown.reasonKeys.includes('quality_structure'), '拆解含结构');

  const hotButWeak = computeRouteTrust({
    uniqueCheckInUsers: 0,
    updatedAtMs: Date.now() - 90 * 24 * 60 * 60 * 1000,
    nowMs: Date.now(),
    verificationStatus: RouteVerificationStatus.PENDING,
    sourceKind: RouteSourceKind.UGC_ORIGINAL,
    forkCount: 0,
    structuredDayCount: 0,
    poiCount: 0,
    boundPoiCount: 0,
    hasDescription: false,
  });
  assert(hotButWeak.contentTier === RouteContentTier.INSPIRATION, '高热度低履约仍为灵感稿');
  assert(
    computeRouteHeatScore({ likeCount: 99, commentCount: 0, collectCount: 0, viewCount: 0 }) >
      computeRouteHeatScore({ likeCount: 0, commentCount: 0, collectCount: 0, viewCount: 1 }),
    '热度分独立于可信度',
  );

  assert(
    isCrawlUnverifiedForTravelReady(RouteSourceKind.CRAWL, RouteVerificationStatus.PENDING),
    '爬取未核验拦截可出行',
  );
  const crawl = computeRouteTrust({
    uniqueCheckInUsers: 5,
    updatedAtMs: Date.now(),
    nowMs: Date.now(),
    verificationStatus: RouteVerificationStatus.PENDING,
    sourceKind: RouteSourceKind.CRAWL,
    forkCount: 3,
    ...quality,
    trustCrowned: true,
  });
  assert(crawl.contentTier === RouteContentTier.INSPIRATION, '爬取未核验即使加冕也不可出行');
  assert(crawl.breakdown.reasonKeys.includes('crawl_unverified'), '拆解含爬取扣分');

  const crowned = computeRouteTrust({
    uniqueCheckInUsers: 0,
    updatedAtMs: Date.now(),
    nowMs: Date.now(),
    verificationStatus: RouteVerificationStatus.PENDING,
    sourceKind: RouteSourceKind.UGC_ORIGINAL,
    forkCount: 0,
    structuredDayCount: 0,
    poiCount: 0,
    boundPoiCount: 0,
    hasDescription: false,
    trustCrowned: true,
  });
  assert(crowned.contentTier === RouteContentTier.TRAVEL_READY, '非爬取源运营加冕 → 可出行');
  console.log('');
}

/**
 * 检查信任字段已迁移。
 */
async function checkColumns() {
  console.log('--- 数据库字段 ---');
  try {
    await getDb()
      .select({
        trustScore: travelRoutes.trustScore,
        trustBreakdown: travelRoutes.trustBreakdown,
        trustCrowned: travelRoutes.trustCrowned,
        contentTier: travelRoutes.contentTier,
      })
      .from(travelRoutes)
      .limit(1);
    assert(true, 'travel_routes 可信度字段可读');
  } catch (err) {
    assert(false, `可信度字段可读: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log('');
}

/**
 * 构造可出行 vs 高热灵感，验证两池结果可区分。
 */
async function checkRecommendVsHot() {
  console.log('--- 主推荐池 vs 热门 ---');
  const db = getDb();
  const demoRows = await db.select({ id: users.id }).from(users).where(eq(users.username, 'demo')).limit(1);
  const adminRows = await db.select({ id: users.id }).from(users).where(eq(users.username, 'admin')).limit(1);
  const demoUserId = demoRows[0]?.id ?? null;
  const adminUserId = adminRows[0]?.id ?? null;
  assert(demoUserId != null && adminUserId != null, 'demo / admin 用户存在');
  if (!demoUserId || !adminUserId) {
    console.log('');
    return;
  }

  const stamp = Date.now();
  const readyRoute = await createInspirationRoute(demoUserId, {
    name: `U3可出行-${stamp}`,
    description: '结构完整且有履约打卡',
    days: 1,
    sourceKind: 'ugc_original',
    routeDetail: {
      days: [
        {
          attractions: [
            { name: '西湖', attractionId: 1 },
            { name: '断桥', attractionId: 2 },
          ],
        },
      ],
    },
  });
  const hotRoute = await createInspirationRoute(demoUserId, {
    name: `U3高热灵感-${stamp}`,
    description: '',
    days: 1,
    sourceKind: 'ugc_original',
  });

  await db
    .update(travelRoutes)
    .set({
      verificationStatus: RouteVerificationStatus.VERIFIED,
      routeDetail: {
        days: [
          {
            attractions: [
              { name: '西湖', attractionId: 1 },
              { name: '断桥', attractionId: 2 },
            ],
          },
        ],
      },
      description: '结构完整且有履约打卡',
    })
    .where(eq(travelRoutes.id, readyRoute.id));

  await db.insert(checkIns).values([
    {
      userId: demoUserId,
      routeId: readyRoute.id,
      location: { latitude: 30.25, longitude: 120.15 },
      cityCode: '330100',
      status: CheckInStatus.APPROVED,
    },
    {
      userId: adminUserId,
      routeId: readyRoute.id,
      location: { latitude: 30.25, longitude: 120.15 },
      cityCode: '330100',
      status: CheckInStatus.APPROVED,
    },
  ]);

  await db
    .update(travelRoutes)
    .set({ likeCount: 80, commentCount: 10, collectCount: 5, viewCount: 200 })
    .where(eq(travelRoutes.id, hotRoute.id));

  const readyBreakdown = await recomputeRouteTrust(readyRoute.id);
  const hotBreakdown = await recomputeRouteTrust(hotRoute.id);
  assert((readyBreakdown?.total ?? 0) >= ROUTE_TRAVEL_READY_THRESHOLD, '可出行样例可信分过门槛');
  assert((hotBreakdown?.total ?? 0) < ROUTE_TRAVEL_READY_THRESHOLD, '高热灵感可信分低于门槛');

  const recommend = await listRoutesForUser(demoUserId, {
    scope: 'plaza',
    sort: 'trust',
    page: 1,
    pageSize: 50,
  });
  const recIds = recommend.items.map((item) => item.id);
  assert(recIds.includes(readyRoute.id), '推荐池包含可出行稿');
  assert(!recIds.includes(hotRoute.id), '推荐池不包含高热灵感稿');
  const recItem = recommend.items.find((item) => item.id === readyRoute.id);
  assert(recItem?.contentTier === RouteContentTier.TRAVEL_READY, '推荐结果 contentTier=travel_ready');
  assert((recItem?.trustScore ?? 0) >= ROUTE_TRAVEL_READY_THRESHOLD, '推荐结果带回 trustScore');
  assert((recItem?.trustBreakdown?.reasonKeys.length ?? 0) > 0, '推荐结果带回可解释 reasonKeys');

  const hotList = await listRoutesForUser(demoUserId, {
    scope: 'plaza',
    sort: 'hot',
    page: 1,
    pageSize: 50,
  });
  const hotIds = hotList.items.map((item) => item.id);
  assert(hotIds.includes(hotRoute.id) && hotIds.includes(readyRoute.id), '热门池同时包含两道样例');
  const hotIdx = hotIds.indexOf(hotRoute.id);
  const readyIdx = hotIds.indexOf(readyRoute.id);
  assert(hotIdx < readyIdx, '热门排序：高热灵感在可出行稿之前（与推荐池不同）');

  await db.delete(checkIns).where(inArray(checkIns.routeId, [readyRoute.id, hotRoute.id]));
  await db.delete(travelRoutes).where(inArray(travelRoutes.id, [readyRoute.id, hotRoute.id]));
  console.log('');
}

async function main() {
  console.log('=== U3 可信分层与主推荐验收 ===\n');
  checkSharedHelpers();
  await checkColumns();
  await checkRecommendVsHot();

  if (failed > 0) {
    console.error(`\nU3 验收失败：${failed} 项未通过`);
    process.exit(1);
  }
  console.log('\nU3 验收通过');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
