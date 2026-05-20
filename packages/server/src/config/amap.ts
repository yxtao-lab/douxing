/** 高德 Web 服务配置（密钥仅从环境变量读取） */

function trimEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

export function getAmapWebKey(): string | null {
  const key = trimEnv('AMAP_WEB_KEY');
  return key || null;
}

export function isAmapGeocodeEnabled(): boolean {
  if (trimEnv('AMAP_ENABLED') === 'false') return false;
  return !!getAmapWebKey();
}

export function getAmapGeocodeTimeoutMs(): number {
  const raw = parseInt(trimEnv('AMAP_GEOCODE_TIMEOUT_MS') || '8000', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 8000;
}
