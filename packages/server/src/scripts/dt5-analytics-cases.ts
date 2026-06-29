/**
 * DT5 · 旅行运营大屏验收
 *
 * 用法：
 *   pnpm --filter @douxing/server dt5:analytics-cases
 */
import '../config/env.js';
import {
  getAnalyticsGeoDistribution,
  getAnalyticsGeoFlows,
} from '../services/analytics-geo.service.js';
import { getAnalyticsFunnel, getAnalyticsOverview } from '../services/analytics.service.js';

let failed = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

async function main(): Promise<boolean> {
  console.log('=== DT5 旅行运营大屏验收 ===\n');

  const overview = await getAnalyticsOverview();
  assert(typeof overview.users.total === 'number', 'overview 用户总数可读');

  const distribution = await getAnalyticsGeoDistribution(30);
  assert(Array.isArray(distribution.provinces), 'geo/distribution 返回 provinces');
  assert(Array.isArray(distribution.cities), 'geo/distribution 返回 cities');
  assert(Array.isArray(distribution.heatPoints), 'geo/distribution 返回 heatPoints');
  assert(Boolean(distribution.generatedAt), 'geo/distribution 含 generatedAt');
  assert(distribution.scopeDays === 30, 'geo/distribution 含 scopeDays');
  assert(
    distribution.effectiveScope === 'window' || distribution.effectiveScope === 'allTime',
    'geo/distribution 含 effectiveScope',
  );

  if (distribution.provinces.length > 0) {
    const first = distribution.provinces[0]!;
    assert(Boolean(first.geoName && first.adcode), '省级统计含 geoName 与 adcode');
  }

  const flows = await getAnalyticsGeoFlows(30, 10);
  assert(Array.isArray(flows), 'geo/flows 返回数组');
  if (flows.length > 0) {
    const flow = flows[0]!;
    assert(flow.count >= 2, '流动计数 ≥ 2');
    assert(Number.isFinite(flow.fromLatitude), '流动含起点坐标');
  }

  const funnel = await getAnalyticsFunnel(30);
  assert(funnel.length === 6, '漏斗 6 步（大屏复用）');

  console.log('');
  if (failed > 0) {
    console.error(`\n${failed} 项失败`);
    return false;
  }
  console.log('DT5 旅行运营大屏验收全部通过');
  return true;
}

export async function runDt5AnalyticsCases(): Promise<boolean> {
  try {
    return await main();
  } catch (err) {
    console.error(err);
    return false;
  }
}

const isDirectRun = process.argv[1]?.includes('dt5-analytics-cases');
if (isDirectRun) {
  runDt5AnalyticsCases().then((passed) => {
    if (!passed) process.exit(1);
  });
}
