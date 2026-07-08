import type {
  AgentToolTraceEntry,
  NodeSpanLlmUsage,
  PlanSessionCostSummary,
} from '@douxing/shared';
import {
  getAmapApiCallCostCny,
  getLlmPricingVersion,
  resolveLlmModelPricing,
} from '../config/llm-pricing.js';

/**
 * 根据 token 用量与模型单价计算 LLM 估算费用（元）。
 *
 * @param usage - 输入/输出 token 与模型名
 * @returns 估算人民币费用；用量为 0 时返回 0
 */
export function calculateLlmCostCny(usage: NodeSpanLlmUsage): number {
  const pricing = resolveLlmModelPricing(usage.model);
  const inputCost = (usage.inputTokens / 1000) * pricing.inputPer1kCny;
  const outputCost = (usage.outputTokens / 1000) * pricing.outputPer1kCny;
  return roundCostCny(inputCost + outputCost);
}

/**
 * 根据外部 API 调用次数计算估算费用（元）。
 *
 * @param callCount - HTTP 调用次数
 * @returns 估算费用
 */
export function calculateExternalApiCostCny(callCount: number): number {
  if (callCount <= 0) return 0;
  return roundCostCny(callCount * getAmapApiCallCostCny());
}

function roundCostCny(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * 为单条 NodeSpan 补充 `estimatedCostCny`（LLM + 外部 API）。
 *
 * @param span - 原始 trace 条目
 * @returns 带估算费用的新条目（不修改原对象）
 */
export function enrichSpanWithEstimatedCost(span: AgentToolTraceEntry): AgentToolTraceEntry {
  let estimatedCostCny = span.estimatedCostCny ?? 0;
  if (span.llmUsage) {
    estimatedCostCny += calculateLlmCostCny(span.llmUsage);
  }
  if (span.externalApiCalls && span.externalApiCalls > 0) {
    estimatedCostCny += calculateExternalApiCostCny(span.externalApiCalls);
  }
  if (estimatedCostCny <= 0 && !span.llmUsage && !span.externalApiCalls) {
    return span;
  }
  return {
    ...span,
    estimatedCostCny: roundCostCny(estimatedCostCny),
  };
}

/**
 * 批量为 NodeSpan 列表补充估算费用。
 *
 * @param spans - toolTrace 列表
 * @returns 带 `estimatedCostCny` 的新列表
 */
export function enrichSpansWithEstimatedCost(
  spans: AgentToolTraceEntry[],
): AgentToolTraceEntry[] {
  return spans.map(enrichSpanWithEstimatedCost);
}

/**
 * 汇总规划会话级 token / 外部 API / 费用明细。
 *
 * @param sessionId - 规划会话 ID
 * @param spans - 规范化后的 NodeSpan 列表
 * @returns 分节点、分模型费用汇总（均为估算值）
 */
export function summarizeWorkflowCost(
  sessionId: number,
  spans: AgentToolTraceEntry[],
): PlanSessionCostSummary {
  const enriched = enrichSpansWithEstimatedCost(spans);

  let totalLlmCostCny = 0;
  let totalExternalApiCostCny = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalExternalApiCalls = 0;

  const modelMap = new Map<
    string,
    { inputTokens: number; outputTokens: number; costCny: number }
  >();

  const byNode = enriched.map((span) => {
    const llmCostCny = span.llmUsage ? calculateLlmCostCny(span.llmUsage) : 0;
    const externalApiCostCny = span.externalApiCalls
      ? calculateExternalApiCostCny(span.externalApiCalls)
      : 0;
    const totalCostCny = roundCostCny(llmCostCny + externalApiCostCny);

    totalLlmCostCny += llmCostCny;
    totalExternalApiCostCny += externalApiCostCny;
    totalExternalApiCalls += span.externalApiCalls ?? 0;

    if (span.llmUsage) {
      totalInputTokens += span.llmUsage.inputTokens;
      totalOutputTokens += span.llmUsage.outputTokens;
      const bucket = modelMap.get(span.llmUsage.model) ?? {
        inputTokens: 0,
        outputTokens: 0,
        costCny: 0,
      };
      bucket.inputTokens += span.llmUsage.inputTokens;
      bucket.outputTokens += span.llmUsage.outputTokens;
      bucket.costCny = roundCostCny(bucket.costCny + llmCostCny);
      modelMap.set(span.llmUsage.model, bucket);
    }

    return {
      nodeId: span.nodeId ?? span.tool,
      tool: span.tool,
      llmCostCny,
      externalApiCostCny,
      totalCostCny,
      llmUsage: span.llmUsage,
      externalApiCalls: span.externalApiCalls,
    };
  });

  return {
    sessionId,
    totalCostCny: roundCostCny(totalLlmCostCny + totalExternalApiCostCny),
    totalLlmCostCny: roundCostCny(totalLlmCostCny),
    totalExternalApiCostCny: roundCostCny(totalExternalApiCostCny),
    totalInputTokens,
    totalOutputTokens,
    totalExternalApiCalls,
    byModel: [...modelMap.entries()].map(([model, stats]) => ({
      model,
      ...stats,
    })),
    byNode,
    isEstimate: true,
    pricingVersion: getLlmPricingVersion(),
  };
}
