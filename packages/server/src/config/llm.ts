/** LLM 多提供商配置（密钥仅从环境变量读取，禁止硬编码） */

export type LlmProviderId = 'douxing' | 'deepseek' | 'lmstudio';

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

function trimEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

export function isLlmEnabled(): boolean {
  return process.env.LLM_ENABLED !== 'false';
}

/** 是否启用 LLM 解析旅行意图（默认随 LLM 总开关） */
export function isLlmIntentParseEnabled(): boolean {
  if (process.env.LLM_INTENT_PARSE_ENABLED === 'false') return false;
  return isLlmEnabled();
}

export function hasDeepseekApiKey(): boolean {
  const key = trimEnv('DEEPSEEK_API_KEY');
  return key.length > 0;
}

/** 百炼专属微调模型凭证是否齐全（DOUXING_LLM_MODEL + API Key） */
export function hasDouxingLlmCredentials(): boolean {
  return Boolean(trimEnv('DOUXING_LLM_API_KEY') && trimEnv('DOUXING_LLM_MODEL'));
}

/**
 * 是否启用兜行百炼微调模型（Step 37 I3）。
 * 显式 `DOUXING_LLM_ENABLED=false` 时关闭；未设置时凭凭证自动启用。
 */
export function isDouxingLlmEnabled(): boolean {
  if (trimEnv('DOUXING_LLM_ENABLED') === 'false') return false;
  return hasDouxingLlmCredentials();
}

export function getDefaultProviderChoice(): LlmProviderChoice {
  const raw = (process.env.LLM_DEFAULT_PROVIDER ?? 'auto').trim().toLowerCase();
  if (raw === 'douxing') return 'douxing';
  if (raw === 'deepseek') return 'deepseek';
  if (raw === 'lmstudio' || raw === 'local' || raw === 'lm-studio') return 'lmstudio';
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
  const apiKey = trimEnv('DEEPSEEK_API_KEY');
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

/**
 * 百炼 DashScope 兼容模式 — 兜行专属 LoRA 部署模型（Step 37）。
 */
export function getDouxingLlmConfig(): LlmProviderConfig {
  const apiKey = trimEnv('DOUXING_LLM_API_KEY');
  const model = trimEnv('DOUXING_LLM_MODEL');
  return {
    id: 'douxing',
    label: '兜行专属模型（百炼）',
    baseUrl: normalizeBaseUrl(
      process.env.DOUXING_LLM_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    ),
    model: model || 'douxing-planner-v0.1',
    apiKey,
    timeoutMs: parseInt(
      process.env.DOUXING_LLM_TIMEOUT_MS ?? process.env.LLM_TIMEOUT_MS ?? '90000',
      10,
    ),
    configured: hasDouxingLlmCredentials(),
  };
}

/** 按 provider id 返回对应配置 */
export function getProviderConfig(provider: LlmProviderId): LlmProviderConfig {
  switch (provider) {
    case 'douxing':
      return getDouxingLlmConfig();
    case 'deepseek':
      return getDeepseekConfig();
    default:
      return getLmStudioConfig();
  }
}

/**
 * 解析实际调用顺序。
 * auto：兜行微调（已配置）→ DeepSeek → LM Studio。
 */
export function resolveProviderChain(choice?: LlmProviderChoice): LlmProviderId[] {
  const selected = choice ?? getDefaultProviderChoice();
  if (selected === 'douxing') {
    return isDouxingLlmEnabled() ? ['douxing'] : [];
  }
  if (selected === 'deepseek') {
    return hasDeepseekApiKey() ? ['deepseek'] : [];
  }
  if (selected === 'lmstudio') {
    return ['lmstudio'];
  }
  const chain: LlmProviderId[] = [];
  if (isDouxingLlmEnabled()) chain.push('douxing');
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
