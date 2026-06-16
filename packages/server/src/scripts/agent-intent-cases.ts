/**
 * C7-b：追问意图路由用例（本地断言，不依赖 DB）
 */
import { routeAgentIntent } from '../services/agent-intent-router.service.js';

const CASES: Array<{ input: string; expect: string }> = [
  { input: '第三天轻松一点', expect: 'tweak_day' },
  { input: '不要雷峰塔，换小众景点', expect: 'tweak_poi' },
  { input: '预算降到3000以内', expect: 'budget_tune' },
  { input: '想住西湖边经济型酒店', expect: 'lodging_tune' },
  { input: '成都有什么好吃的', expect: 'qa_food' },
  { input: '就方案B', expect: 'select_variant' },
  { input: '帮我规划杭州3日游', expect: 'plan_new' },
  { input: '第二天改轻松点', expect: 'tweak_day' },
  { input: '别去河坊街', expect: 'tweak_poi' },
  { input: '第三天换几个景点', expect: 'tweak_day' },
];

let failed = 0;
for (const c of CASES) {
  const routed = routeAgentIntent(c.input);
  if (routed.route !== c.expect) {
    failed += 1;
    console.error(`[FAIL] "${c.input}" => ${routed.route}, expected ${c.expect}`);
  } else {
    console.log(`[OK] ${c.input} => ${routed.route}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${CASES.length} 用例失败`);
  process.exit(1);
}
console.log(`\n全部 ${CASES.length} 条追问路由用例通过`);
