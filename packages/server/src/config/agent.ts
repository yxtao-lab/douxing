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

export function verifyAgentToolAuth(headerValue: string | undefined): boolean {
  const secret = getAgentToolSecret();
  if (!secret) {
    return process.env.NODE_ENV === 'development';
  }
  return headerValue === secret;
}
