/**
 * W2 · 规划 workflow 费用与诊断 API 验收
 *
 * 用法：
 *   pnpm --filter @douxing/server w2:workflow-cost-cases
 */
import '../config/env.js';
import type { AgentToolTraceEntry, NodeSpanLlmUsage } from '@douxing/shared';
import { buildNodeSpan } from '@douxing/shared';
import {
  calculateLlmCostCny,
  calculateExternalApiCostCny,
  enrichSpanWithEstimatedCost,
  summarizeWorkflowCost,
} from '../services/workflow-cost.service.js';
import { getLlmProviderPricing, getLlmPricingVersion } from '../config/llm-pricing.js';
import { buildLangfuseSessionUrl } from '../observability/langfuse-client.service.js';

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
 * 构造带 LLM 用量的 mock NodeSpan。
 *
 * @param usage - token 用量
 * @returns AgentToolTraceEntry
 */
function mockLlmSpan(usage: NodeSpanLlmUsage): AgentToolTraceEntry {
  return buildNodeSpan({
    nodeId: 'generate_route_draft-1',
    tool: 'generate_route_draft',
    ok: true,
    ms: 1200,
    llmUsage: usage,
  });
}

/**
 * 运行 W2 费用计算与类型验收。
 *
 * @returns 全部通过时为 true
 */
export async function runW2WorkflowCostCases(): Promise<boolean> {
  console.log('=== W2 规划费用与诊断验收 ===\n');

  const deepseekPricing = getLlmProviderPricing('deepseek');
  assert(deepseekPricing.inputPer1kCny >= 0, 'deepseek 输入单价可读');
  assert(deepseekPricing.outputPer1kCny >= 0, 'deepseek 输出单价可读');
  assert(getLlmPricingVersion().length > 0, '单价版本号非空');

  const llmCost = calculateLlmCostCny({
    model: 'deepseek-chat',
    inputTokens: 1000,
    outputTokens: 500,
  });
  assert(llmCost > 0, 'LLM 费用计算 > 0');

  const externalCost = calculateExternalApiCostCny(3);
  assert(externalCost >= 0, '外部 API 费用非负');

  const enriched = enrichSpanWithEstimatedCost(
    mockLlmSpan({ model: 'deepseek-chat', inputTokens: 2000, outputTokens: 800 }),
  );
  assert(
    typeof enriched.estimatedCostCny === 'number' && enriched.estimatedCostCny > 0,
    'NodeSpan estimatedCostCny 已回填',
  );

  const summary = summarizeWorkflowCost(42, [
    enriched,
    buildNodeSpan({
      nodeId: 'enrich_route-1',
      tool: 'enrich_route',
      ok: true,
      ms: 800,
      externalApiCalls: 5,
    }),
  ]);
  assert(summary.sessionId === 42, '费用汇总 sessionId 正确');
  assert(summary.byNode.length === 2, '分节点明细 2 条');
  assert(summary.totalExternalApiCalls === 5, '外部 API 调用合计');
  assert(summary.isEstimate === true, '标记为估算值');
  assert(summary.byModel.length >= 1, '分模型汇总非空');

  const langfuseUrl = buildLangfuseSessionUrl(42);
  if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_PROJECT_ID) {
    assert(typeof langfuseUrl === 'string' && langfuseUrl.includes('/sessions/42'), 'Langfuse 深链含 sessionId');
  } else {
    assert(langfuseUrl == null, '未配置 Langfuse 时深链为 null');
  }

  console.log(`\n=== 结果：${failed === 0 ? '全部通过' : `${failed} 项失败`} ===`);
  return failed === 0;
}

const isDirectRun = process.argv[1]?.includes('w2-workflow-cost-cases');
if (isDirectRun) {
  runW2WorkflowCostCases()
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
