/**
 * C7-b Step 5：追问局部修改 E2E 断言（内存 draft，不依赖 DB）
 */
import type { TravelIntentSnapshot } from '@douxing/shared';
import type { GeneratedRouteDraft } from '../services/route-generator.service.js';
import {
  listPlayPoiNamesForDay,
  matchesExcludePoiName,
  patchRouteDay,
  resolveDayIndexForExclusion,
} from '../services/patch-route-day.service.js';
import { routeAgentIntent } from '../services/agent-intent-router.service.js';

const BASE_INTENT: TravelIntentSnapshot = {
  city: '杭州',
  days: 3,
  budget: null,
  budgetMin: null,
  budgetMax: null,
  themes: ['休闲'],
  departureCity: null,
  suggestedDestinations: [],
  excludeProvinceCodes: [],
  transportPreference: null,
  lodgingArea: null,
  lodgingTier: null,
  startDate: null,
  constraintSummary: null,
  confidence: 'medium',
};

function buildMockDraft(): GeneratedRouteDraft {
  return {
    name: '杭州3日游',
    description: '测试路线',
    budgetRange: '2000-4000',
    days: 3,
    interestTags: ['休闲'],
    sceneTags: [],
    matchedCity: '杭州',
    unlockPrice: 9.9,
    isAiGenerated: true,
    routeDetail: {
      days: [
        {
          date: '第1天',
          title: '西湖文化',
          attractions: [
            { name: '西湖', time: '09:00', cost: 0, description: '西湖' },
            { name: '灵隐寺', time: '14:00', cost: 75, description: '灵隐寺' },
          ],
        },
        {
          date: '第2天',
          title: '西溪宋城',
          attractions: [
            { name: '西溪湿地', time: '09:00', cost: 80, description: '西溪' },
            { name: '宋城', time: '14:00', cost: 300, description: '宋城' },
          ],
        },
        {
          date: '第3天',
          title: '城南',
          attractions: [
            { name: '河坊街', time: '09:00', cost: 0, description: '河坊街' },
            { name: '雷峰塔', time: '13:00', cost: 40, description: '雷峰塔' },
            { name: '太子湾', time: '16:00', cost: 0, description: '太子湾' },
          ],
        },
      ],
    },
  };
}

function namesKey(draft: GeneratedRouteDraft, dayIndex: number): string {
  return JSON.stringify(listPlayPoiNamesForDay(draft, dayIndex));
}

let failed = 0;

function assertCase(name: string, ok: boolean, detail?: string) {
  if (!ok) {
    failed += 1;
    console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`[OK] ${name}`);
  }
}

async function main() {
  const draft = buildMockDraft();
  const day0Before = namesKey(draft, 0);
  const day1Before = namesKey(draft, 1);

  const relaxedRouted = routeAgentIntent('第三天轻松一点');
  assertCase('路由：第三天轻松一点 => tweak_day', relaxedRouted.route === 'tweak_day');
  assertCase('路由：第三天 dayIndex=2', relaxedRouted.dayIndex === 2);

  const relaxedDraft = await patchRouteDay({
    draft,
    dayIndex: relaxedRouted.dayIndex!,
    relaxed: relaxedRouted.relaxed,
    intent: BASE_INTENT,
    skipFinalize: true,
  });
  assertCase('轻松：第1天 POI 不变', namesKey(relaxedDraft, 0) === day0Before);
  assertCase('轻松：第2天 POI 不变', namesKey(relaxedDraft, 1) === day1Before);
  assertCase(
    '轻松：第3天 POI 减少',
    listPlayPoiNamesForDay(relaxedDraft, 2).length <= 2,
  );

  const excludeRouted = routeAgentIntent('别去河坊街');
  assertCase('路由：别去河坊街 => tweak_poi', excludeRouted.route === 'tweak_poi');
  assertCase(
    '路由：自动定位河坊街所在天',
    resolveDayIndexForExclusion(draft, excludeRouted.excludePoiNames ?? []) === 2,
  );

  const excludeDraft = await patchRouteDay({
    draft,
    excludeNames: excludeRouted.excludePoiNames,
    intent: BASE_INTENT,
    prompt: '别去河坊街',
    skipFinalize: true,
  });
  assertCase('排除：第1天 POI 不变', namesKey(excludeDraft, 0) === day0Before);
  assertCase('排除：第2天 POI 不变', namesKey(excludeDraft, 1) === day1Before);
  assertCase(
    '排除：第3天不含河坊街',
    !listPlayPoiNamesForDay(excludeDraft, 2).some((n) => matchesExcludePoiName(n, ['河坊街'])),
  );
  assertCase(
    '排除：第3天仍有其它 POI',
    listPlayPoiNamesForDay(excludeDraft, 2).length >= 2,
  );

  if (failed > 0) {
    console.error(`\n${failed} 条 Step 5 E2E 用例失败`);
    process.exit(1);
  }
  console.log(`\n全部 Step 5 局部修改 E2E 用例通过`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
