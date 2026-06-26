/**
 * DT3 · 客户端埋点验收
 *
 * 用法：
 *   pnpm --filter @douxing/server dt3:analytics-cases
 */
import '../config/env.js';
import {
  AnalyticsEventCategory,
  AnalyticsEventName,
  AnalyticsEventSource,
  isClientAnalyticsEventName,
} from '@douxing/shared';
import {
  getAnalyticsFunnel,
  trackAnalyticsEvent,
  trackAnalyticsEvents,
} from '../services/analytics.service.js';

let failed = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

async function main() {
  console.log('=== DT3 客户端埋点验收 ===\n');

  assert(isClientAnalyticsEventName(AnalyticsEventName.PLAN_PAGE_VIEW), '白名单含 plan.page_view');
  assert(!isClientAnalyticsEventName('admin.secret'), '非白名单事件被拒绝');

  const sessionId = `dt3-test-${Date.now()}`;
  await trackAnalyticsEvents([
    {
      eventName: AnalyticsEventName.PLAN_PAGE_VIEW,
      eventCategory: AnalyticsEventCategory.BEHAVIOR,
      sessionId,
      source: AnalyticsEventSource.MOBILE,
    },
    {
      eventName: AnalyticsEventName.PLAN_PROMPT_SUBMIT,
      eventCategory: AnalyticsEventCategory.BEHAVIOR,
      sessionId,
      source: AnalyticsEventSource.MOBILE,
    },
    {
      eventName: AnalyticsEventName.PLAN_SESSION_CREATED,
      eventCategory: AnalyticsEventCategory.BEHAVIOR,
      sessionId,
      source: AnalyticsEventSource.MOBILE,
      properties: { routeId: 1 },
    },
  ]);

  await trackAnalyticsEvent({
    eventName: AnalyticsEventName.PLAN_PAGE_VIEW,
    eventCategory: AnalyticsEventCategory.BEHAVIOR,
    sessionId: `${sessionId}-pc`,
    source: AnalyticsEventSource.PC,
  });

  const funnel = await getAnalyticsFunnel(30);
  assert(funnel.length === 6, '漏斗 6 个步骤');
  assert(funnel.some((step) => step.count > 0), '漏斗至少一步有数据');

  const planPageStep = funnel.find((step) => step.stepKey === 'planPage');
  assert(Boolean(planPageStep && planPageStep.count >= 2), 'planPage 步骤计数 ≥ 2');

  console.log('');
  if (failed > 0) {
    console.error(`\n${failed} 项失败`);
    return false;
  }
  console.log('DT3 客户端埋点验收全部通过');
  return true;
}

export async function runDt3AnalyticsCases(): Promise<boolean> {
  try {
    return await main();
  } catch (err) {
    console.error(err);
    return false;
  }
}

const isDirectRun = process.argv[1]?.includes('dt3-analytics-cases');
if (isDirectRun) {
  runDt3AnalyticsCases().then((passed) => {
    if (!passed) process.exit(1);
  });
}
