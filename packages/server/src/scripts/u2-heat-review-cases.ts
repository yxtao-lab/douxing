/**
 * U2 · 点赞·评价·热度榜验收
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server u2:heat-review-cases
 */
import '../config/env.js';
import { eq, sql } from 'drizzle-orm';
import {
  ApiMessageKey,
  computeRouteHeatScore,
  isRouteReviewTagSlug,
  normalizeRouteReviewTags,
  parseRouteReviewRating,
  resolveApiMessage,
  ROUTE_HEAT_WEIGHTS,
  routeReviewTagPresets,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { routeComments } from '../db/schema/route-comments.js';
import { createRouteComment, listRouteComments } from '../services/route-comment.service.js';
import { listRoutesForUser } from '../services/route-interaction.service.js';
import { createInspirationRoute } from '../services/route.service.js';

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
 * 校验热度公式与评价标签工具。
 */
function checkSharedHelpers() {
  console.log('--- shared 热度 / 评价标签 ---');
  assert(ROUTE_HEAT_WEIGHTS.COMMENT > ROUTE_HEAT_WEIGHTS.LIKE, '评价权重大于点赞');
  assert(
    computeRouteHeatScore({ likeCount: 1, commentCount: 1, collectCount: 1, viewCount: 1 }) ===
      ROUTE_HEAT_WEIGHTS.LIKE +
        ROUTE_HEAT_WEIGHTS.COMMENT +
        ROUTE_HEAT_WEIGHTS.COLLECT +
        ROUTE_HEAT_WEIGHTS.VIEW,
    '热度公式与权重一致',
  );
  assert(isRouteReviewTagSlug('easy_walk'), 'easy_walk 合法');
  assert(!isRouteReviewTagSlug('not_a_tag'), '非法 slug 拒绝');
  assert(normalizeRouteReviewTags(['easy_walk', 'easy_walk', 'scenic']).length === 2, '标签去重');
  assert(parseRouteReviewRating(5) === 5, '星级 5 合法');
  assert(parseRouteReviewRating(0) === undefined, '星级 0 非法');
  assert(parseRouteReviewRating(null) === null, '未评分返回 null');
  assert(routeReviewTagPresets.length >= 6, '评价标签预设充足');

  for (const key of [
    ApiMessageKey.ROUTE_REVIEW_RATING_INVALID,
    ApiMessageKey.ROUTE_REVIEW_TAGS_INVALID,
  ] as const) {
    assert(resolveApiMessage(key, 'zh-CN').length > 0, `zh-CN ${key}`);
    assert(resolveApiMessage(key, 'en-US').length > 0, `en-US ${key}`);
  }
  console.log('');
}

/**
 * 检查评论表 U2 字段。
 */
async function checkColumns() {
  console.log('--- 数据库字段 ---');
  try {
    await getDb()
      .select({
        rating: routeComments.rating,
        reviewTags: routeComments.reviewTags,
      })
      .from(routeComments)
      .limit(1);
    assert(true, 'route_comments.rating / review_tags 可读');
  } catch (err) {
    assert(false, `route_comments U2 字段可读: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log('');
}

/**
 * 发表带标签评价，并验证热门/最新排序。
 */
async function checkReviewAndHeatSort() {
  console.log('--- 评价标签 + 热度排序 ---');
  const db = getDb();
  const demoRows = await db.select({ id: users.id }).from(users).where(eq(users.username, 'demo')).limit(1);
  const demoUserId = demoRows[0]?.id ?? null;
  assert(demoUserId != null, 'demo 用户存在');
  if (!demoUserId) {
    console.log('');
    return;
  }

  const stamp = Date.now();
  const hotRoute = await createInspirationRoute(demoUserId, {
    name: `U2热度高-${stamp}`,
    description: '高热度样例',
    days: 2,
    sourceKind: 'ugc_original',
  });
  const coldRoute = await createInspirationRoute(demoUserId, {
    name: `U2热度低-${stamp}`,
    description: '低热度样例',
    days: 1,
    sourceKind: 'ugc_original',
  });

  await db
    .update(travelRoutes)
    .set({ likeCount: 10, commentCount: 5, collectCount: 3, viewCount: 20 })
    .where(eq(travelRoutes.id, hotRoute.id));
  await db
    .update(travelRoutes)
    .set({ likeCount: 0, commentCount: 0, collectCount: 0, viewCount: 1 })
    .where(eq(travelRoutes.id, coldRoute.id));

  const commented = await createRouteComment(hotRoute.id, demoUserId, {
    content: '行程节奏舒服，亲子友好',
    rating: 5,
    reviewTags: ['easy_walk', 'family_friendly'],
  });
  assert(commented != null, '可发表带标签评价');
  assert(commented?.rating === 5, '星级回传');
  assert(
    commented?.reviewTags?.includes('easy_walk') && commented?.reviewTags?.includes('family_friendly'),
    '评价标签回传',
  );

  let invalidCaught = false;
  try {
    await createRouteComment(hotRoute.id, demoUserId, {
      content: '坏标签',
      reviewTags: ['not_a_real_tag'],
    });
  } catch {
    invalidCaught = true;
  }
  assert(invalidCaught, '非法评价标签被拒绝');

  const listed = await listRouteComments(hotRoute.id, { limit: 10, sort: 'recent' });
  assert(
    listed.some((c) => c.id === commented?.id && (c.reviewTags?.length ?? 0) >= 2),
    '列表含结构化评价标签',
  );

  const plazaHot = await listRoutesForUser(demoUserId, {
    scope: 'plaza',
    sort: 'hot',
    page: 1,
    pageSize: 50,
  });
  const hotIdx = plazaHot.items.findIndex((item) => item.id === hotRoute.id);
  const coldIdx = plazaHot.items.findIndex((item) => item.id === coldRoute.id);
  assert(hotIdx >= 0 && coldIdx >= 0, '热门列表包含两道样例');
  assert(hotIdx < coldIdx, '热门排序：高热度在前');
  assert(
    (plazaHot.items[hotIdx]?.heatScore ?? 0) >
      (plazaHot.items[coldIdx]?.heatScore ?? 0),
    'heatScore 与排序一致',
  );

  const plazaRecent = await listRoutesForUser(demoUserId, {
    scope: 'plaza',
    sort: 'recent',
    page: 1,
    pageSize: 50,
  });
  const recentIds = plazaRecent.items.map((item) => item.id);
  const coldRecentIdx = recentIds.indexOf(coldRoute.id);
  const hotRecentIdx = recentIds.indexOf(hotRoute.id);
  assert(coldRecentIdx >= 0 && hotRecentIdx >= 0, '最新列表包含两道样例');
  assert(coldRecentIdx < hotRecentIdx, '最新排序：后创建的在前（不受热度干扰）');

  await db.delete(routeComments).where(
    sql`${routeComments.routeId} IN (${hotRoute.id}, ${coldRoute.id})`,
  );
  await db.delete(travelRoutes).where(
    sql`${travelRoutes.id} IN (${hotRoute.id}, ${coldRoute.id})`,
  );
  console.log('');
}

async function main() {
  console.log('=== U2 点赞·评价·热度榜验收 ===\n');
  checkSharedHelpers();
  await checkColumns();
  await checkReviewAndHeatSort();

  if (failed > 0) {
    console.error(`\nU2 验收失败：${failed} 项未通过`);
    process.exit(1);
  }
  console.log('\nU2 验收通过');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
