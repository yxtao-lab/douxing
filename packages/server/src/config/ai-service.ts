/** Python AI 微服务配置（C5） */

export function isAiServiceEnabled(): boolean {
  return process.env.AI_SERVICE_ENABLED === 'true';
}

export function getAiServiceBaseUrl(): string {
  const raw = (process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8100').trim();
  return raw.replace(/\/+$/, '');
}

export function getAiServiceTimeoutMs(): number {
  return parseInt(process.env.AI_SERVICE_TIMEOUT_MS ?? '120000', 10);
}

export function canUseAiService(): boolean {
  return isAiServiceEnabled() && getAiServiceBaseUrl().length > 0;
}
