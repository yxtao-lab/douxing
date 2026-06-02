/** 阿里云 OSS 配置（景点封面等静态资源，密钥仅从环境变量读取） */

function trimEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

export function isOssEnabled(): boolean {
  if (trimEnv('OSS_ENABLED') !== 'true') return false;
  return !!(getOssAccessKeyId() && getOssAccessKeySecret() && getOssBucket());
}

export function getOssRegion(): string {
  return trimEnv('OSS_REGION') || 'oss-cn-hangzhou';
}

export function getOssBucket(): string {
  return trimEnv('OSS_BUCKET');
}

export function getOssAccessKeyId(): string {
  return trimEnv('OSS_ACCESS_KEY_ID');
}

export function getOssAccessKeySecret(): string {
  return trimEnv('OSS_ACCESS_KEY_SECRET');
}

/** CDN 公网基址（优先）；未配置则用 Bucket 默认域名 */
export function getOssCdnBaseUrl(): string | null {
  const cdn = trimEnv('OSS_CDN_BASE_URL');
  return cdn ? cdn.replace(/\/$/, '') : null;
}

/** 景点封面对象键前缀，默认 attractions/ */
export function getOssAttractionsPrefix(): string {
  const raw = trimEnv('OSS_ATTRACTIONS_PREFIX') || 'attractions/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** Wikimedia 封面兜底，默认开启（OSS 无关） */
export function isWikimediaImageEnrichEnabled(): boolean {
  return trimEnv('WIKIMEDIA_IMAGE_ENRICH_ENABLED') !== 'false';
}
