/** H9-3：跨城大交通（班次）配置，密钥仅从环境变量读取 */

function trimEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

export type IntercityProvider = 'auto' | 'catalog' | 'template' | 'juhe';

/** 班次查询 provider：auto=juhe(若配置) → catalog → template */
export function getIntercityProvider(): IntercityProvider {
  const raw = trimEnv('INTERCITY_PROVIDER').toLowerCase();
  if (raw === 'catalog' || raw === 'template' || raw === 'juhe') {
    return raw;
  }
  return 'auto';
}

export function isIntercityTransitEnabled(): boolean {
  return trimEnv('INTERCITY_ENABLED') !== 'false';
}

/** 聚合数据 Juhe API Key（火车余票/时刻查询，可选） */
export function getJuheApiKey(): string | null {
  const key = trimEnv('JUHE_API_KEY');
  return key || null;
}

export function getIntercityRequestTimeoutMs(): number {
  const raw = parseInt(trimEnv('INTERCITY_REQUEST_TIMEOUT_MS') || '8000', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 8000;
}
