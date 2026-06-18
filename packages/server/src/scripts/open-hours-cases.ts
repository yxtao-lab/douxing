/**
 * H9+-5 · Step 19 开放时长补全验收
 *
 * 用法：
 *   pnpm --filter @douxing/server open-hours:cases
 */
import '../config/env.js';
import {
  checkVisitOpenHours,
  formatEnricherWarning,
  parseWeekdayFromCalendarDate,
} from '@douxing/shared';
import { ATTRACTION_SEEDS } from '../data/attraction-seeds.js';
import { PLAYBOOK_TOP_10_CITIES } from '../data/playbook-top-cities.js';

/** 故宫闭馆验收日：2026-06-15（周一） */
const FORBIDDEN_CITY_MONDAY = '2026-06-15';

const MIN_TOP_CITY_OPEN_HOURS_COVERAGE = 0.45;

let failed = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

function hasOpenHoursData(seed: (typeof ATTRACTION_SEEDS)[number]): boolean {
  return (
    (seed.openHours?.windows?.length ?? 0) > 0 ||
    (seed.openHours?.closedWeekdays?.length ?? 0) > 0
  );
}

function checkSeedCoverage(): void {
  console.log('--- TOP 10 城市 openHours 覆盖率 ---');
  const topCitySet = new Set<string>(PLAYBOOK_TOP_10_CITIES);
  const topSeeds = ATTRACTION_SEEDS.filter((seed) => topCitySet.has(seed.city));
  const withHours = topSeeds.filter(hasOpenHoursData);
  const coverage = topSeeds.length === 0 ? 1 : withHours.length / topSeeds.length;

  for (const city of PLAYBOOK_TOP_10_CITIES) {
    const citySeeds = topSeeds.filter((seed) => seed.city === city);
    const cityWithHours = citySeeds.filter(hasOpenHoursData).length;
    console.log(`  ${city}: ${cityWithHours}/${citySeeds.length}`);
  }

  assert(
    coverage >= MIN_TOP_CITY_OPEN_HOURS_COVERAGE,
    `TOP 10 覆盖率 ${(coverage * 100).toFixed(0)}% ≥ ${(MIN_TOP_CITY_OPEN_HOURS_COVERAGE * 100).toFixed(0)}%`,
  );
  console.log('');
}

function checkClosedDayWarning(): void {
  console.log('--- 闭馆日 warning ---');
  const palace = ATTRACTION_SEEDS.find((seed) => seed.name === '故宫博物院');
  assert(Boolean(palace?.openHours?.closedWeekdays?.includes(1)), '故宫博物院 seed 含周一闭馆');

  const weekday = parseWeekdayFromCalendarDate(FORBIDDEN_CITY_MONDAY);
  assert(weekday === 1, '验收日 parseWeekday 为周一');

  const result = checkVisitOpenHours(9 * 60, 11 * 60, palace!.openHours!, weekday);
  assert(result.conflict && result.kind === 'closed_day', '周一访问故宫判定 closed_day');

  const zhWarning = formatEnricherWarning('closedDay', 'zh-CN', { name: '故宫博物院' });
  const enWarning = formatEnricherWarning('closedDay', 'en-US', { name: '故宫博物院' });
  assert(zhWarning.includes('闭馆'), 'zh-CN closedDay 文案');
  assert(enWarning.toLowerCase().includes('closed'), 'en-US closedDay 文案');
  console.log('');
}

function checkOpenWindowWarning(): void {
  console.log('--- 开放窗口 warning ---');
  const tower = ATTRACTION_SEEDS.find((seed) => seed.name === '雷峰塔');
  assert(Boolean(tower?.openHours), '雷峰塔 seed 含 openHours');

  const early = checkVisitOpenHours(7 * 60, 8 * 60, tower!.openHours!, 2);
  assert(early.conflict && early.kind === 'before_open', '过早到访判定 before_open');

  const ok = checkVisitOpenHours(9 * 60 + 30, 11 * 60, tower!.openHours!, 2);
  assert(!ok.conflict, '正常时段无冲突');
  console.log('');
}

function main(): void {
  console.log('=== H9+-5 开放时长补全验收（Step 19）===\n');
  checkSeedCoverage();
  checkClosedDayWarning();
  checkOpenWindowWarning();

  if (failed > 0) {
    console.error(`Step 19 验收失败：${failed} 项未通过`);
    process.exit(1);
  }
  console.log('=== Step 19 验收全部通过 ===');
}

main();
