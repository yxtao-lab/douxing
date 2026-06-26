/**
 * DT2 · 指标日汇总验收
 *
 * 用法：
 *   pnpm --filter @douxing/server dt2:analytics-cases
 */
import '../config/env.js';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { analyticsDailyMetrics } from '../db/schema/analytics-daily-metrics.js';
import {
  aggregateMetricsForDate,
  getDefaultRollupDate,
  rollupAnalyticsDailyMetricsForDate,
} from '../services/analytics-rollup.service.js';
import { getAnalyticsTrends } from '../services/analytics.service.js';

let failed = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

export async function runDt2AnalyticsCases(): Promise<boolean> {
  try {
    return await main();
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function main(): Promise<boolean> {
  console.log('=== DT2 指标日汇总验收 ===\n');

  const targetDate = getDefaultRollupDate();
  const live = await aggregateMetricsForDate(targetDate);
  const rolled = await rollupAnalyticsDailyMetricsForDate(targetDate);

  assert(rolled.date === targetDate, '跑批返回目标日期');
  assert(rolled.users === live.users, '用户新增与实时聚合一致');
  assert(rolled.routes === live.routes, '路线新增与实时聚合一致');
  assert(rolled.orders === live.orders, '订单新增与实时聚合一致');
  assert(rolled.checkins === live.checkins, '打卡新增与实时聚合一致');
  assert(rolled.planSessions === live.planSessions, '规划会话与实时聚合一致');

  const db = getDb();
  const [row] = await db
    .select()
    .from(analyticsDailyMetrics)
    .where(eq(analyticsDailyMetrics.metricDate, targetDate))
    .limit(1);

  assert(Boolean(row), '汇总表存在目标日行');
  assert(row?.usersNew === live.users, '汇总表 users_new 正确');

  const trends = await getAnalyticsTrends(7);
  assert(trends.length === 7, '趋势 API 返回 7 天');
  const trendPoint = trends.find((point) => point.date === targetDate);
  assert(Boolean(trendPoint), '趋势 API 含昨日数据点');
  assert(trendPoint?.users === live.users, '趋势 API 昨日用户与汇总一致');

  console.log('');
  if (failed > 0) {
    console.error(`\n${failed} 项失败`);
    return false;
  }
  console.log('DT2 指标日汇总验收全部通过');
  return true;
}

const isDirectRun = process.argv[1]?.includes('dt2-analytics-cases');
if (isDirectRun) {
  runDt2AnalyticsCases().then((passed) => {
    if (!passed) process.exit(1);
  });
}
