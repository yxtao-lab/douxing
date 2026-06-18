/**
 * C7 M2 · Step 12～14 本地断言（无 DB / 无 LLM）
 */
import type { TravelIntentSnapshot } from '@douxing/shared';
import {
  appendPlanAssistantWarnings,
  collectRouteDetailWarnings,
  formatAgentStatusLabel,
} from '@douxing/shared';
import { AGENT_TOOL_NAMES } from '../agent/tools/index.js';
import { runBuildRouteVariantsTool } from '../agent/tools/build-route-variants.tool.js';

let failed = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

const sampleIntent: TravelIntentSnapshot = {
  city: '成都',
  days: 3,
  budget: '5000',
  budgetMin: null,
  budgetMax: null,
  themes: ['美食'],
  confidence: 'medium',
  cities: ['成都'],
  suggestedDestinations: ['成都'],
};

// Step 12 · warnings 进对话
const deduped = collectRouteDetailWarnings({
  days: [
    { warnings: ['武侯祠 当日闭馆，请调整行程', '武侯祠 当日闭馆，请调整行程'] },
    { warnings: ['「春熙路→宽窄巷子」交通班次为估算'] },
  ],
});
assert(deduped.length === 2, 'Step 12 collectRouteDetailWarnings 去重');

const zhReply = appendPlanAssistantWarnings(
  '已为您生成「成都 3 日游」',
  {
    routeDetail: {
      days: [{ warnings: ['武侯祠 当日闭馆，请调整行程'] }],
    },
  },
  'zh-CN',
);
assert(zhReply.includes('行程提示：'), 'Step 12 zh-CN warnings 标题');
assert(zhReply.includes('闭馆'), 'Step 12 warnings 正文');

const enReply = appendPlanAssistantWarnings(
  'Generated plan',
  { routeDetail: { days: [{ warnings: ['Closed today'] }] } },
  'en-US',
);
assert(enReply.includes('Trip notes:'), 'Step 12 en-US warnings 标题');

const noWarnings = appendPlanAssistantWarnings(
  '无 warnings',
  { routeDetail: { days: [{ title: 'Day 1', date: '第1天', attractions: [] }] } },
  'zh-CN',
);
assert(noWarnings === '无 warnings', 'Step 12 无 warnings 时不追加');

// Step 13 · build_route_variants Tool
const variantResult = await runBuildRouteVariantsTool({
  intent: sampleIntent,
  locale: 'zh-CN',
  candidateCount: 3,
});
assert(variantResult.ok, 'Step 13 build_route_variants 成功');
if (variantResult.ok) {
  const variants = variantResult.data.variants as Array<{ key: string; label: string; hint: string }>;
  assert(variants.length >= 2 && variants.length <= 3, 'Step 13 产出 2～3 个变体');
  assert(Boolean(variants[0]?.label && variants[0]?.hint), 'Step 13 变体含 label/hint');
  const foodIntent: TravelIntentSnapshot = { ...sampleIntent, themes: ['美食'] };
  const foodVariants = await runBuildRouteVariantsTool({
    intent: foodIntent,
    locale: 'zh-CN',
    candidateCount: 3,
  });
  if (foodVariants.ok) {
    const keys = (foodVariants.data.variants as Array<{ key: string }>).map((v) => v.key);
    assert(keys.includes('food'), 'Step 13 美食主题覆盖 food 变体');
  }
}

assert(AGENT_TOOL_NAMES.includes('build_route_variants'), 'Step 13 Tool 已注册');
assert(
  formatAgentStatusLabel('build_route_variants', 'zh-CN').includes('候选'),
  'Step 13 agent.status i18n zh-CN',
);
assert(
  formatAgentStatusLabel('build_route_variants', 'en-US').length > 0,
  'Step 13 agent.status i18n en-US',
);

// Step 14 · 首句 Agent 前置（Tool 链与 flag 存在性）
assert(AGENT_TOOL_NAMES.includes('generate_route_draft'), 'Step 14 generate_route_draft Tool 可用');
assert(AGENT_TOOL_NAMES.includes('validate_route'), 'Step 14 validate_route Tool 可用');

if (failed > 0) {
  console.error(`\n${failed} 条 M2 Step 12～14 用例失败`);
  process.exit(1);
}
console.log('\n全部 M2 Step 12～14 本地用例通过');
