/**
 * H9+-4 · Step 18 出发日期解析验收
 *
 * 用法：
 *   pnpm --filter @douxing/server start-date:cases
 */
import '../config/env.js';
import { resolveCalendarDateFromStart, resolveRouteDayCalendarDate } from '@douxing/shared';
import { buildIntentFromHistory, parseTravelIntent } from '../services/travel-intent.service.js';
import { resolveTravelDateIso } from '../services/intercity-transit.service.js';
import {
  hasExplicitStartDateInPrompt,
  parseStartDateFromText,
} from '../services/parse-start-date.service.js';

/** 固定参考日：2026-06-15（周一），保证相对日期可重复验收 */
const REFERENCE_DATE = new Date('2026-06-15T12:00:00');

interface StartDateCase {
  id: string;
  prompt: string;
  expect: string;
}

const PARSE_CASES: StartDateCase[] = [
  { id: 'next-wed', prompt: '下周三去杭州玩西湖', expect: '2026-06-24' },
  { id: 'tomorrow', prompt: '明天出发上海3天', expect: '2026-06-16' },
  { id: 'iso', prompt: '2026-07-01成都美食', expect: '2026-07-01' },
  { id: 'month-day', prompt: '6月20日杭州西湖', expect: '2026-06-20' },
  { id: 'next-fri', prompt: '下周五从武汉去杭州', expect: '2026-06-26' },
  { id: 'day-after', prompt: '后天去厦门鼓浪屿', expect: '2026-06-17' },
];

let failed = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

function checkParseCases(): void {
  console.log('--- C2 规则解析 startDate ---');
  for (const testCase of PARSE_CASES) {
    const parsed = parseStartDateFromText(testCase.prompt, REFERENCE_DATE);
    assert(parsed === testCase.expect, `${testCase.id} => ${parsed ?? '(null)'}`);
  }
  console.log('');
}

function checkIntentIntegration(): void {
  console.log('--- 意图快照集成 ---');
  const isoIntent = parseTravelIntent('2026-07-01成都3天美食');
  assert(isoIntent.startDate === '2026-07-01', 'parseTravelIntent 写入 ISO startDate');

  const fromHistory = buildIntentFromHistory([], '2026-08-10杭州3天文化之旅', undefined);
  assert(fromHistory.startDate === '2026-08-10', 'buildIntentFromHistory 写入 ISO startDate');
  assert(
    hasExplicitStartDateInPrompt('下周三去杭州', REFERENCE_DATE),
    'hasExplicitStartDateInPrompt',
  );
  console.log('');
}

function checkEnricherCalendarChain(): void {
  console.log('--- Enricher / 班次日历链 ---');
  const startDate = parseStartDateFromText('下周三去杭州', REFERENCE_DATE)!;
  assert(startDate === '2026-06-24', '验收用例出发日');

  const day0 = resolveRouteDayCalendarDate({ date: '第1天', calendarDate: undefined }, 0, startDate);
  const day1 = resolveRouteDayCalendarDate({ date: '第2天', calendarDate: undefined }, 1, startDate);
  assert(day0 === '2026-06-24', '第1天 calendarDate = startDate');
  assert(day1 === '2026-06-25', '第2天 calendarDate = startDate + 1');

  const intercityDay0 = resolveTravelDateIso(0, null, startDate);
  const intercityDay1 = resolveTravelDateIso(1, null, startDate);
  assert(intercityDay0 === day0, '跨城班次 day0 与 Enricher 一致');
  assert(intercityDay1 === day1, '跨城班次 day1 与 Enricher 一致');

  assert(
    resolveCalendarDateFromStart(0, startDate) === '2026-06-24',
    'shared resolveCalendarDateFromStart 一致',
  );
  console.log('');
}

function main(): void {
  console.log('=== H9+-4 出发日期解析验收（Step 18）===\n');
  checkParseCases();
  checkIntentIntegration();
  checkEnricherCalendarChain();

  if (failed > 0) {
    console.error(`Step 18 验收失败：${failed} 项未通过`);
    process.exit(1);
  }
  console.log('=== Step 18 验收全部通过 ===');
}

main();
