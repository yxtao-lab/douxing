/**
 * C7-b Step 4：四类意图分支解析用例（本地断言）
 */
import { parseVariantIndexFromPrompt } from '../services/select-plan-variant.service.js';
import { routeAgentIntent } from '../services/agent-intent-router.service.js';

const VARIANT_CASES: Array<{ input: string; expect: number | null }> = [
  { input: '就方案B', expect: 1 },
  { input: '选方案A', expect: 0 },
  { input: '方案C吧', expect: 2 },
  { input: '帮我规划杭州', expect: null },
];

const BRANCH_CASES: Array<{ input: string; expect: string }> = [
  { input: '预算降到3000以内', expect: 'budget_tune' },
  { input: '想住西湖边经济型酒店', expect: 'lodging_tune' },
  { input: '成都有什么好吃的', expect: 'qa_food' },
  { input: '就方案B', expect: 'select_variant' },
];

let failed = 0;

for (const c of VARIANT_CASES) {
  const index = parseVariantIndexFromPrompt(c.input);
  if (index !== c.expect) {
    failed += 1;
    console.error(`[FAIL] variant "${c.input}" => ${index}, expected ${c.expect}`);
  } else {
    console.log(`[OK] variant ${c.input} => ${index}`);
  }
}

for (const c of BRANCH_CASES) {
  const routed = routeAgentIntent(c.input);
  if (routed.route !== c.expect) {
    failed += 1;
    console.error(`[FAIL] branch "${c.input}" => ${routed.route}, expected ${c.expect}`);
  } else {
    console.log(`[OK] branch ${c.input} => ${routed.route}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} 条 Step 4 用例失败`);
  process.exit(1);
}
console.log(`\n全部 Step 4 分支用例通过`);
