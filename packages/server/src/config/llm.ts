/** LM Studio / OpenAI 兼容 LLM 配置（从环境变量读取） */

function normalizeBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

export interface LlmConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

export function getLlmConfig(): LlmConfig {
  const enabled = process.env.LLM_ENABLED !== 'false';
  return {
    enabled,
    baseUrl: normalizeBaseUrl(process.env.LLM_BASE_URL ?? 'http://127.0.0.1:1234/v1'),
    model: process.env.LLM_MODEL ?? 'local-model',
    apiKey: process.env.LLM_API_KEY ?? 'lm-studio',
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS ?? '120000', 10),
  };
}

export function isLlmEnabled(): boolean {
  return getLlmConfig().enabled;
}
