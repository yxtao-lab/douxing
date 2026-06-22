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

/** Wikimedia 封面兜底，默认开启（OSS 无关） */
export function isWikimediaImageEnrichEnabled(): boolean {
  return trimEnv('WIKIMEDIA_IMAGE_ENRICH_ENABLED') !== 'false';
}
