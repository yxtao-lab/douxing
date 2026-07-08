/** W2-1 · LLM 与外部 API 单价配置（环境变量可覆盖，禁止硬编码密钥） */

import type { LlmProviderId } from './llm.js';

/** 每 1K token 的人民币单价 */
export interface LlmModelPricing {
  inputPer1kCny: number;
  outputPer1kCny: number;
}

const DEFAULT_LLM_PRICING: Record<LlmProviderId, LlmModelPricing> = {
  deepseek: { inputPer1kCny: 0.001, outputPer1kCny: 0.002 },
  douxing: { inputPer1kCny: 0.004, outputPer1kCny: 0.012 },
  lmstudio: { inputPer1kCny: 0, outputPer1kCny: 0 },
};

const PRICING_VERSION = '2026-07-08';

function parseEnvPrice(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * 读取指定 LLM 提供方的 token 单价（元 / 1K tokens）。
 *
 * @param provider - deepseek / douxing / lmstudio
 * @returns 输入与输出单价；未知 provider 回退 deepseek 默认
 */
export function getLlmProviderPricing(provider: LlmProviderId): LlmModelPricing {
  const defaults = DEFAULT_LLM_PRICING[provider] ?? DEFAULT_LLM_PRICING.deepseek;
  const prefix = `LLM_PRICING_${provider.toUpperCase()}`;
  return {
    inputPer1kCny: parseEnvPrice(`${prefix}_INPUT_PER_1K_CNY`, defaults.inputPer1kCny),
    outputPer1kCny: parseEnvPrice(`${prefix}_OUTPUT_PER_1K_CNY`, defaults.outputPer1kCny),
  };
}

/**
 * 按模型名解析单价；优先匹配 provider 前缀，否则按 model 字符串模糊匹配。
 *
 * @param model - LLM 模型 ID 或 provider 名
 * @returns 对应单价配置
 */
export function resolveLlmModelPricing(model: string): LlmModelPricing {
  const normalized = model.trim().toLowerCase();
  if (normalized.includes('deepseek')) return getLlmProviderPricing('deepseek');
  if (normalized.includes('douxing') || normalized.includes('qwen')) {
    return getLlmProviderPricing('douxing');
  }
  if (normalized.includes('lmstudio') || normalized.includes('local')) {
    return getLlmProviderPricing('lmstudio');
  }
  return getLlmProviderPricing('deepseek');
}

/**
 * 单次高德 Web API 调用的估算费用（元）。
 *
 * @returns 单价；默认 0（不计费，仅计数）
 */
export function getAmapApiCallCostCny(): number {
  return parseEnvPrice('AMAP_API_CALL_CNY', 0);
}

/**
 * 当前单价表版本号，便于费用报表对账。
 *
 * @returns 版本字符串
 */
export function getLlmPricingVersion(): string {
  return process.env.LLM_PRICING_VERSION?.trim() || PRICING_VERSION;
}
