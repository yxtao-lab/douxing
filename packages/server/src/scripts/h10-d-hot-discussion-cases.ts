/**
 * H10-d · Step 40 热评聚合与外链讨论验收
 *
 * 用法：pnpm --filter @douxing/server h10-d:hot-discussion-cases
 */

import {
  isAllowedExternalDiscussionUrl,
  detectExternalDiscussionPlatform,
  sortRouteCommentsByHot,
  type RouteCommentInfo,
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
 * 校验外链 URL 白名单。
 */
function checkExternalUrlValidation() {
  console.log('--- 外链 URL 校验 ---');
  assert(
    isAllowedExternalDiscussionUrl('https://www.xiaohongshu.com/explore/abc'),
    '小红书 HTTPS 链接通过',
  );
  assert(
    isAllowedExternalDiscussionUrl('https://v.douyin.com/abc123/'),
    '抖音短链通过',
  );
  assert(!isAllowedExternalDiscussionUrl('http://www.xiaohongshu.com/x'), 'HTTP 拒绝');
  assert(!isAllowedExternalDiscussionUrl('https://evil.com/x'), '非白名单域名拒绝');
  assert(
    detectExternalDiscussionPlatform('https://www.xiaohongshu.com/x') === 'xiaohongshu',
    '识别小红书平台',
  );
  console.log('');
}

/**
 * 校验热门评论排序。
 */
function checkHotCommentSort() {
  console.log('--- 热门评论排序 ---');
  const comments: RouteCommentInfo[] = [
    {
      id: 1,
      routeId: 1,
      userId: 1,
      userNickname: 'A',
      userAvatar: null,
      content: '普通',
      likeCount: 2,
      isFeatured: false,
      createdAt: '2026-01-03T00:00:00.000Z',
    },
    {
      id: 2,
      routeId: 1,
      userId: 2,
      userNickname: 'B',
      userAvatar: null,
      content: '精选',
      likeCount: 0,
      isFeatured: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 3,
      routeId: 1,
      userId: 3,
      userNickname: 'C',
      userAvatar: null,
      content: '高赞',
      likeCount: 10,
      isFeatured: false,
      createdAt: '2026-01-02T00:00:00.000Z',
    },
  ];
  const sorted = sortRouteCommentsByHot(comments);
  assert(sorted[0]?.id === 2, '精选评论排第一');
  assert(sorted[1]?.id === 3, '非精选按点赞数排第二');
  assert(sorted[2]?.id === 1, '低赞排后');
  console.log('');
}

console.log('=== H10-d · Step 40 热评聚合验收 ===\n');
checkExternalUrlValidation();
checkHotCommentSort();

if (failed > 0) {
  console.error(`\n=== 失败 ${failed} 项 ===`);
  process.exit(1);
}
console.log('\n=== H10-d 本地验收通过 ===');
