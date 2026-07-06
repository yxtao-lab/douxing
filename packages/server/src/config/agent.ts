/** Phase 1：Agent 规划 feature flag 与内网鉴权 */

function readEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

export function isAgentPlanEnabled(): boolean {
  return readEnv('AGENT_PLAN_ENABLED') === 'true';
}

export function getAgentToolSecret(): string | null {
  const secret = readEnv('AGENT_TOOL_SECRET');
  return secret || null;
}

export function getAiServiceBaseUrl(): string {
  return readEnv('AI_SERVICE_URL') || 'http://127.0.0.1:8100';
}

export function getAgentPlanTimeoutMs(): number {
  const raw = parseInt(readEnv('AGENT_PLAN_TIMEOUT_MS') || '180000', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 180000;
}

/**
 * plan_agent 默认 LLM 提供方（未指定 session provider 时沿用）。
 * 读取 `AGENT_PLAN_DEFAULT_PROVIDER`，否则与 `LLM_DEFAULT_PROVIDER` 一致，默认 `auto`。
 *
 * @returns 提供方标识
 */
export function getAgentPlanDefaultProvider(): string {
  const agentDefault = readEnv('AGENT_PLAN_DEFAULT_PROVIDER');
  if (agentDefault) return agentDefault;
  return readEnv('LLM_DEFAULT_PROVIDER') || 'auto';
}

export function verifyAgentToolAuth(headerValue: string | undefined): boolean {
  const secret = getAgentToolSecret();
  if (!secret) {
    return process.env.NODE_ENV === 'development';
  }
  return headerValue === secret;
}
