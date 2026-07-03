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

/** 用户旅行照片对象键前缀，默认 photos/ */
export function getOssPhotosPrefix(): string {
  const raw = trimEnv('OSS_PHOTOS_PREFIX') || 'photos/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** H10-b：路线 UGC 短视频对象键前缀，默认 videos/ */
export function getOssVideosPrefix(): string {
  const raw = trimEnv('OSS_VIDEOS_PREFIX') || 'videos/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** ML 训练数据集 OSS 前缀，默认 douxing/datasets/v0.1/ */
export function getOssMlDatasetsPrefix(): string {
  const raw = trimEnv('OSS_ML_DATASETS_PREFIX') || 'douxing/datasets/v0.1/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** ML LoRA checkpoint 输出 OSS 前缀，默认 douxing/checkpoints/v0.1/ */
export function getOssMlCheckpointsPrefix(): string {
  const raw = trimEnv('OSS_ML_CHECKPOINTS_PREFIX') || 'douxing/checkpoints/v0.1/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** 拼 PAI / ossutil 使用的 oss:// URI */
export function buildOssUri(objectKey: string): string {
  const bucket = getOssBucket();
  const key = objectKey.replace(/^\//, '');
  return `oss://${bucket}/${key}`;
}

/** Wikimedia 封面兜底；生产默认开启，开发环境默认关闭（commons 国内常不可达） */
export function isWikimediaImageEnrichEnabled(): boolean {
  const flag = trimEnv('WIKIMEDIA_IMAGE_ENRICH_ENABLED');
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  return process.env.NODE_ENV !== 'development';
}

/**
 * Wikimedia API 请求超时（毫秒）。
 *
 * @returns 默认 5000；由 `WIKIMEDIA_FETCH_TIMEOUT_MS` 控制
 */
export function getWikimediaFetchTimeoutMs(): number {
  const raw = parseInt(trimEnv('WIKIMEDIA_FETCH_TIMEOUT_MS') || '5000', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 5000;
}

/**
 * Wikimedia 搜索无图时的负缓存 TTL（秒），避免同景点反复请求。
 *
 * @returns 默认 86400（24 小时）；由 `WIKIMEDIA_MISS_CACHE_TTL_SEC` 控制
 */
export function getWikimediaMissCacheTtlSec(): number {
  const raw = parseInt(trimEnv('WIKIMEDIA_MISS_CACHE_TTL_SEC') || '86400', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 86400;
}

/**
 * Wikimedia 请求失败时的负缓存 TTL（秒），避免网络故障期间刷屏重试。
 *
 * @returns 默认 900（15 分钟）；由 `WIKIMEDIA_ERROR_CACHE_TTL_SEC` 控制
 */
export function getWikimediaErrorCacheTtlSec(): number {
  const raw = parseInt(trimEnv('WIKIMEDIA_ERROR_CACHE_TTL_SEC') || '900', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 900;
}
