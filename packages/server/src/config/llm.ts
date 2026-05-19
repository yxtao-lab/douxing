/** LLM 多提供商配置（密钥仅从环境变量读取，禁止硬编码） */

export type LlmProviderId = 'lmstudio' | 'deepseek';

export type LlmProviderChoice = LlmProviderId | 'auto';

export interface LlmProviderConfig {
  id: LlmProviderId;
  label: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  configured: boolean;
}

function normalizeBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

export function isLlmEnabled(): boolean {
  return process.env.LLM_ENABLED !== 'false';
}

export function hasDeepseekApiKey(): boolean {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  return Boolean(key && key.length > 0);
}

export function getDefaultProviderChoice(): LlmProviderChoice {
  const raw = (process.env.LLM_DEFAULT_PROVIDER ?? 'auto').trim().toLowerCase();
  if (raw === 'deepseek' || raw === 'lmstudio' || raw === 'local' || raw === 'lm-studio') {
    return raw === 'deepseek' ? 'deepseek' : 'lmstudio';
  }
  return 'auto';
}

export function getLmStudioConfig(): LlmProviderConfig {
  return {
    id: 'lmstudio',
    label: '本地 LM Studio',
    baseUrl: normalizeBaseUrl(process.env.LLM_BASE_URL ?? 'http://127.0.0.1:1234/v1'),
    model: process.env.LLM_MODEL ?? 'local-model',
    apiKey: process.env.LLM_API_KEY ?? 'lm-studio',
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS ?? '120000', 10),
    configured: true,
  };
}

export function getDeepseekConfig(): LlmProviderConfig {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? '';
  return {
    id: 'deepseek',
    label: 'DeepSeek 云端',
    baseUrl: normalizeBaseUrl(
      process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
    ),
    model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    apiKey,
    timeoutMs: parseInt(process.env.DEEPSEEK_TIMEOUT_MS ?? process.env.LLM_TIMEOUT_MS ?? '120000', 10),
    configured: hasDeepseekApiKey(),
  };
}

export function getProviderConfig(provider: LlmProviderId): LlmProviderConfig {
  return provider === 'deepseek' ? getDeepseekConfig() : getLmStudioConfig();
}

/** 解析实际调用顺序（auto：优先 DeepSeek，其次 LM Studio） */
export function resolveProviderChain(choice?: LlmProviderChoice): LlmProviderId[] {
  const selected = choice ?? getDefaultProviderChoice();
  if (selected === 'deepseek') {
    return hasDeepseekApiKey() ? ['deepseek'] : [];
  }
  if (selected === 'lmstudio') {
    return ['lmstudio'];
  }
  const chain: LlmProviderId[] = [];
  if (hasDeepseekApiKey()) chain.push('deepseek');
  chain.push('lmstudio');
  return chain;
}

/** @deprecated 兼容旧代码 */
export function getLlmConfig() {
  const c = getLmStudioConfig();
  return {
    enabled: isLlmEnabled(),
    baseUrl: c.baseUrl,
    model: c.model,
    apiKey: c.apiKey,
    timeoutMs: c.timeoutMs,
  };
}
