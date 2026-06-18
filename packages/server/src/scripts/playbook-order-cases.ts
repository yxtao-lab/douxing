/**
 * H9+-3 · Step 20 Playbook POI soft 对齐验收
 *
 * 用法：
 *   pnpm --filter @douxing/server playbook-order:cases
 */
import '../config/env.js';
import { ROUTE_PLAYBOOKS } from '../data/route-playbooks.js';
import {
  computeClassicOrderAlignmentScore,
  countClassicOrderInversions,
  reorderPoisByClassicOrder,
  softAlignDayPoisToPlaybook,
} from '../services/playbook-order-align.service.js';
import type { RouteDayAttraction } from '@douxing/shared';

const westLake = ROUTE_PLAYBOOKS.find((item) => item.id === 'hangzhou-west-lake')!;
const playbookMatch = [{ playbook: westLake, score: 24 }];

function spot(name: string): RouteDayAttraction {
  return { name, time: '09:00-11:00', cost: 0, description: '' };
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

function checkInversionsAndScore(): void {
  console.log('--- 乱序检测 ---');
  const scrambled = [
    spot('雷峰塔'),
    spot('断桥残雪'),
    spot('苏堤'),
    spot('花港观鱼'),
  ];
  const inversions = countClassicOrderInversions(scrambled, westLake.classicOrder);
  assert(inversions > 0, `乱序样例逆序对 ${inversions} > 0`);

  const scoreBefore = computeClassicOrderAlignmentScore(scrambled, westLake.classicOrder);
  const reordered = reorderPoisByClassicOrder(scrambled, westLake.classicOrder);
  const scoreAfter = computeClassicOrderAlignmentScore(reordered, westLake.classicOrder);
  assert(scoreBefore < scoreAfter, `对齐得分 ${scoreBefore.toFixed(2)} → ${scoreAfter.toFixed(2)}`);
  assert(reordered[0]?.name === '断桥残雪', '重排后首站为断桥残雪');
  console.log('');
}

function checkSoftAlign(): void {
  console.log('--- soft 对齐 + warning ---');
  const scrambled = [spot('雷峰塔'), spot('断桥残雪'), spot('苏堤')];
  const zh = softAlignDayPoisToPlaybook(scrambled, playbookMatch, 'zh-CN', '西湖经典');
  assert(zh.reordered, '乱序时触发重排');
  assert(zh.playbookId === 'hangzhou-west-lake', '命中西湖 playbook');
  assert(zh.attractions[0]?.name === '断桥残雪', '重排贴近 classicOrder');
  assert(zh.warnings.some((item) => item.includes('西湖景区')), 'zh-CN 调整顺序 warning');

  const en = softAlignDayPoisToPlaybook(scrambled, playbookMatch, 'en-US', '西湖经典');
  assert(en.warnings.some((item) => item.toLowerCase().includes('classic route')), 'en-US warning');

  const ordered = [spot('断桥残雪'), spot('苏堤'), spot('雷峰塔')];
  const ok = softAlignDayPoisToPlaybook(ordered, playbookMatch, 'zh-CN', '西湖');
  assert(!ok.reordered, '已对齐时不重排');
  assert(ok.warnings.length === 0, '已对齐时不 warning');

  const tooFew = softAlignDayPoisToPlaybook([spot('雷峰塔')], playbookMatch, 'zh-CN');
  assert(!tooFew.reordered, '单 POI 不触发对齐');
  console.log('');
}

function main(): void {
  console.log('=== H9+-3 POI soft 对齐验收（Step 20）===\n');
  checkInversionsAndScore();
  checkSoftAlign();

  if (failed > 0) {
    console.error(`Step 20 验收失败：${failed} 项未通过`);
    process.exit(1);
  }
  console.log('=== Step 20 验收全部通过 ===');
}

main();
