/**
 * H10-a · Step 38 路线可信度（景点说明 + 评论强化）验收
 *
 * 用法：pnpm --filter @douxing/server h10-a:trust-cases
 */
import {
  buildRoutePoiKey,
  filterRouteComments,
  hasPoiTrustContent,
  resolvePoiDisplayDescription,
  type RouteCommentInfo,
  type RouteDayAttraction,
} from '@douxing/shared';

let failed = 0;

/**
 * 断言条件成立，否则记为失败。
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
 * 校验 POI 说明合并逻辑。
 */
function checkPoiDescriptionMerge() {
  console.log('--- POI 说明合并 ---');
  const merged = resolvePoiDisplayDescription('西湖漫步', '西湖风景名胜区，位于杭州市西湖区。');
  assert(merged.includes('西湖风景名胜区'), '优先采用更完整的景点库说明');
  assert(
    resolvePoiDisplayDescription('', '仅库说明') === '仅库说明',
    '无内联说明时使用库说明',
  );
  console.log('');
}

/**
 * 校验 POI 信任链展示判定。
 */
function checkPoiTrustContent() {
  console.log('--- POI 信任链素材 ---');
  const spot: RouteDayAttraction = {
    name: '雷峰塔',
    time: '10:00',
    cost: 40,
    description: '',
    catalogDescription: '雷峰塔位于西湖南岸',
    checkInPhotoUrls: ['/uploads/a.jpg'],
  };
  assert(hasPoiTrustContent(spot), '库说明或打卡图应触发信任链入口');
  assert(
    buildRoutePoiKey(1, spot) === '1::n::雷峰塔',
    '无 attractionId 时 POI 键稳定',
  );
  console.log('');
}

/**
 * 校验评论筛选语义。
 */
function checkCommentFilter() {
  console.log('--- 评论筛选 ---');
  const comments: RouteCommentInfo[] = [
    {
      id: 1,
      routeId: 9,
      userId: 1,
      userNickname: 'A',
      userAvatar: null,
      content: '路线不错',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      routeId: 9,
      userId: 2,
      userNickname: 'B',
      userAvatar: null,
      content: '西湖很美',
      dayIndex: 0,
      attractionId: 12,
      poiName: '西湖',
      createdAt: '2026-01-02T00:00:00.000Z',
    },
    {
      id: 3,
      routeId: 9,
      userId: 3,
      userNickname: 'C',
      userAvatar: null,
      content: '第二天轻松',
      dayIndex: 1,
      poiName: null,
      createdAt: '2026-01-03T00:00:00.000Z',
    },
  ];
  assert(filterRouteComments(comments, { attractionId: 12 }).length === 1, '按 attractionId 筛选');
  assert(filterRouteComments(comments, { dayIndex: 1 }).length === 1, '按 dayIndex 筛选');
  assert(filterRouteComments(comments, {}).length === 3, '无筛选返回全量');
  console.log('');
}

function main() {
  console.log('=== H10-a 路线可信度验收（Step 38）===\n');
  checkPoiDescriptionMerge();
  checkPoiTrustContent();
  checkCommentFilter();

  if (failed > 0) {
    console.error(`H10-a 验收失败：${failed} 项未通过`);
    process.exit(1);
  }

  console.log('=== H10-a 验收全部通过 ===');
  process.exit(0);
}

main();
