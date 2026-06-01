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

/** 景点封面自动补全（高德 POI 图），默认跟随 AMAP_ENABLED */
export function isAmapImageEnrichEnabled(): boolean {
  const flag = trimEnv('AMAP_IMAGE_ENRICH_ENABLED');
  if (flag === 'false') return false;
  if (flag === 'true') return !!getAmapWebKey();
  return isAmapGeocodeEnabled();
}

export function getAmapImageFetchDelayMs(): number {
  const raw = parseInt(trimEnv('AMAP_IMAGE_FETCH_DELAY_MS') || '300', 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : 300;
}
