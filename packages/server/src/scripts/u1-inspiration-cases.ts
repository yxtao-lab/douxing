/**
 * U1 · 灵感稿上传与广场发布验收
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server u1:inspiration-cases
 */
import '../config/env.js';
import { eq, sql } from 'drizzle-orm';
import {
  ApiMessageKey,
  isRoutePendingVerification,
  resolveApiMessage,
  RouteContentTier,
  RouteModerationStatus,
  RouteSourceKind,
  RouteVerificationStatus,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { createInspirationRoute, getRouteById } from '../services/route.service.js';
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
 * 校验待核验判定与 API i18n。
 */
function checkSharedHelpers() {
  console.log('--- shared 工具 ---');
  assert(
    isRoutePendingVerification(RouteSourceKind.CRAWL, RouteVerificationStatus.PENDING),
    'crawl + pending → 待核验',
  );
  assert(
    !isRoutePendingVerification(RouteSourceKind.CRAWL, RouteVerificationStatus.VERIFIED),
    'crawl + verified → 不待核验',
  );
  assert(
    !isRoutePendingVerification(RouteSourceKind.UGC_ORIGINAL, RouteVerificationStatus.PENDING),
    'ugc_original → 不强制待核验',
  );

  const keys = [
    ApiMessageKey.ROUTE_INSPIRATION_CREATE_FAILED,
    ApiMessageKey.ROUTE_SOURCE_KIND_INVALID,
    ApiMessageKey.ROUTE_FORK_PARENT_REQUIRED,
    ApiMessageKey.ROUTE_FORK_PARENT_NOT_FOUND,
  ] as const;
  for (const key of keys) {
    const zh = resolveApiMessage(key, 'zh-CN');
    const en = resolveApiMessage(key, 'en-US');
    assert(zh.length > 0 && zh !== key, `zh-CN ${key}`);
    assert(en.length > 0 && en !== key, `en-US ${key}`);
  }
  console.log('');
}

/**
 * 检查 travel_routes U1 字段是否已迁移。
 */
async function checkColumns() {
  console.log('--- 数据库字段 ---');
  const db = getDb();
  try {
    await db
      .select({
        sourceKind: travelRoutes.sourceKind,
        contentTier: travelRoutes.contentTier,
        verificationStatus: travelRoutes.verificationStatus,
        moderationStatus: travelRoutes.moderationStatus,
        parentRouteId: travelRoutes.parentRouteId,
      })
      .from(travelRoutes)
      .limit(1);
    assert(true, 'travel_routes U1 字段可读');
  } catch (err) {
    assert(false, `travel_routes U1 字段可读: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log('');
}

/**
 * 创建灵感稿并校验广场可见与标签。
 */
async function checkInspirationPublish() {
  console.log('--- 灵感稿发布 ---');
  const db = getDb();
  const demoRows = await db.select({ id: users.id }).from(users).where(eq(users.username, 'demo')).limit(1);
  const demoUserId = demoRows[0]?.id ?? null;
  assert(demoUserId != null, 'demo 用户存在');
  if (!demoUserId) {
    console.log('');
    return;
  }

  const stamp = Date.now();
  const created = await createInspirationRoute(demoUserId, {
    name: `U1灵感验收-${stamp}`,
    description: 'U1 用例自动创建，可删',
    days: 2,
    budgetRange: '800-1500',
    sourceKind: 'ugc_original',
  });

  assert(created.isPublic === true, '灵感稿默认公开到广场');
  assert(created.sourceKind === RouteSourceKind.UGC_ORIGINAL, '来源=ugc_original');
  assert(created.contentTier === RouteContentTier.INSPIRATION, '层级=inspiration');
  assert(created.verificationStatus === RouteVerificationStatus.PENDING, '核验=pending');
  assert(created.moderationStatus === RouteModerationStatus.APPROVED, '审核=approved（基础钩子通过）');
  assert(created.pendingVerification !== true, '原创灵感不标待核验');

  const plaza = await listRoutesForUser(demoUserId, { scope: 'plaza', page: 1, pageSize: 50 });
  assert(
    plaza.items.some((item) => item.id === created.id),
    '广场列表可见刚发布的灵感稿',
  );

  const detail = await getRouteById(created.id, demoUserId, { recordView: false });
  assert(detail?.sourceKind === RouteSourceKind.UGC_ORIGINAL, '详情回传来源标签');
  assert(detail?.contentTier === RouteContentTier.INSPIRATION, '详情回传内容层级');

  await db.delete(travelRoutes).where(eq(travelRoutes.id, created.id));
  console.log('');
}

/**
 * 校验爬取源「待核验」展示字段。
 */
async function checkCrawlPendingBadge() {
  console.log('--- 爬取源待核验 ---');
  const db = getDb();
  const demoRows = await db.select({ id: users.id }).from(users).where(eq(users.username, 'demo')).limit(1);
  const demoUserId = demoRows[0]?.id ?? null;
  if (!demoUserId) {
    assert(false, 'demo 用户存在（爬取用例）');
    console.log('');
    return;
  }

  const [insertResult] = await db.insert(travelRoutes).values({
    name: `U1爬取待核验-${Date.now()}`,
    description: '爬取样例',
    budgetRange: '500-1000',
    days: 1,
    interestTags: [],
    routeDetail: { days: [], isUnlocked: true },
    creatorId: demoUserId,
    status: 1,
    isPublic: 1,
    sourceKind: RouteSourceKind.CRAWL,
    contentTier: RouteContentTier.INSPIRATION,
    verificationStatus: RouteVerificationStatus.PENDING,
    moderationStatus: RouteModerationStatus.APPROVED,
  });
  const crawlId = Number(insertResult.insertId);
  const detail = await getRouteById(crawlId, demoUserId, { recordView: false });
  assert(detail?.pendingVerification === true, '爬取未核验 → pendingVerification');
  assert(
    isRoutePendingVerification(detail?.sourceKind, detail?.verificationStatus),
    '待核验工具与详情字段一致',
  );

  await db.execute(sql`DELETE FROM travel_routes WHERE id = ${crawlId}`);
  console.log('');
}

async function main() {
  console.log('=== U1 灵感稿上传与广场发布验收 ===\n');
  checkSharedHelpers();
  await checkColumns();
  await checkInspirationPublish();
  await checkCrawlPendingBadge();

  if (failed > 0) {
    console.error(`\nU1 验收失败：${failed} 项未通过`);
    process.exit(1);
  }
  console.log('\nU1 验收通过');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
