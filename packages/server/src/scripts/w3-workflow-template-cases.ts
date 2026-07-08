/**
 * W3 · 工作流模板与 JSON Logic 选择器验收
 *
 * 用法：
 *   pnpm --filter @douxing/server w3:workflow-template-cases
 */
import '../config/env.js';
import { evaluateJsonLogic } from '../utils/json-logic.util.js';
import { WORKFLOW_TEMPLATE_SEEDS } from '../data/workflow-templates.seed.js';
import {
  buildWorkflowTemplateSelectionContext,
  hashUserIdForAbBucket,
  selectWorkflowTemplate,
} from '../services/workflow-template-selector.service.js';
import { runSelectWorkflowTemplateTool } from '../agent/tools/select-workflow-template.tool.js';

let failed = 0;

/**
 * 断言条件成立，否则计入失败数。
 *
 * @param condition - 期望为 true
 * @param label - 用例描述
 */
function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

/**
 * 运行 W3 模板选择验收。
 *
 * @returns 全部通过时为 true
 */
async function runW3WorkflowTemplateCases(): Promise<boolean> {
  console.log('=== W3 工作流模板验收 ===\n');

  assert(WORKFLOW_TEMPLATE_SEEDS.length >= 3, '预置模板 ≥3 套');
  assert(
    WORKFLOW_TEMPLATE_SEEDS.some((item) => item.nodeConfig.topK === 8),
    'budget 模板 topK=8 已定义',
  );

  assert(
    evaluateJsonLogic({ '>': [{ var: 'days' }, 5] }, { days: 7 }),
    'JSON Logic > days 命中',
  );
  assert(
    !evaluateJsonLogic({ '>': [{ var: 'days' }, 5] }, { days: 3 }),
    'JSON Logic > days 未命中',
  );
  assert(
    evaluateJsonLogic(
      {
        and: [
          { '!=': [{ var: 'budgetMax' }, null] },
          { '<=': [{ var: 'budgetMax' }, 3000] },
        ],
      },
      { budgetMax: 2500 },
    ),
    'JSON Logic 低预算规则命中',
  );

  const premiumCtx = buildWorkflowTemplateSelectionContext({
    userId: 1,
    intent: { days: 7, city: '成都', themes: [] },
  });
  assert(premiumCtx.days === 7, 'selection context days 正确');

  const premium = await selectWorkflowTemplate({
    userId: 1,
    intent: { days: 7, city: '成都', themes: [], cities: ['成都', '重庆'] },
  });
  assert(premium.templateId === 'premium_multi', '7 天多城 → premium_multi');
  assert(premium.nodeConfig.topK === 20, 'premium_multi topK=20');

  const budget = await selectWorkflowTemplate({
    userId: 2,
    intent: { days: 3, city: '成都', themes: [], budgetMax: 2000 },
  });
  assert(budget.templateId === 'budget_short', '低预算 → budget_short');
  assert(budget.nodeConfig.topK === 8, 'budget_short topK=8');

  const standard = await selectWorkflowTemplate({
    userId: 3,
    intent: { days: 3, city: '成都', themes: [], budgetMax: 5000 },
  });
  assert(standard.templateId === 'standard_3d', '默认 → standard_3d');

  const bucketA = hashUserIdForAbBucket(42);
  const bucketB = hashUserIdForAbBucket(42);
  assert(bucketA === bucketB, 'A/B hash 稳定');

  const toolResult = await runSelectWorkflowTemplateTool({
    userId: 1,
    intent: { days: 3, city: '深圳', themes: [], budgetMax: 1500 },
    routedIntent: 'plan_new',
  });
  assert(toolResult.ok === true, 'select_workflow_template Tool 成功');
  if (toolResult.ok) {
    assert(typeof toolResult.data.templateId === 'string', 'Tool 返回 templateId');
    assert(typeof toolResult.data.nodeConfig === 'object', 'Tool 返回 nodeConfig');
  }

  console.log(`\n=== 结果：${failed === 0 ? '全部通过' : `${failed} 项失败`} ===`);
  return failed === 0;
}

runW3WorkflowTemplateCases()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
