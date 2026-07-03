/**
 * H10-b/c · Step 38+ 路线 UGC 短视频验收
 *
 * 用法：pnpm --filter @douxing/server h10-bc:trust-cases
 */
import {
  hasPoiTrustContent,
  ROUTE_VIDEO_MAX_DURATION_SEC,
  ROUTE_VIDEO_MAX_FILE_BYTES,
  type RouteDayAttraction,
} from '@douxing/shared';
import { buildPoiMediaIndexKey } from '../services/route-media.service.js';

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
 * 校验视频常量与 POI 信任链识别。
 */
function checkVideoTrustRules() {
  console.log('--- 视频常量与信任链 ---');
  assert(ROUTE_VIDEO_MAX_DURATION_SEC === 60, '路线视频最长 60 秒');
  assert(ROUTE_VIDEO_MAX_FILE_BYTES === 50 * 1024 * 1024, '路线视频最大 50MB');

  const spot: RouteDayAttraction = {
    name: '断桥',
    time: '09:00',
    cost: 0,
    description: '',
    videoUrl: '/uploads/videos/u1/sample.mp4',
  };
  assert(hasPoiTrustContent(spot), '存在 videoUrl 时应展示信任链入口');
  console.log('');
}

/**
 * 校验 POI 媒体索引键。
 */
function checkPoiMediaIndexKey() {
  console.log('--- POI 媒体索引 ---');
  assert(
    buildPoiMediaIndexKey(2, ' 西湖 ') === '2::西湖',
    'dayIndex + poiName 索引键应去首尾空格',
  );
  console.log('');
}

checkVideoTrustRules();
checkPoiMediaIndexKey();

if (failed > 0) {
  console.error(`\n验收失败：${failed} 项未通过`);
  process.exit(1);
}

console.log('\nH10-b/c 验收脚本全部通过');
