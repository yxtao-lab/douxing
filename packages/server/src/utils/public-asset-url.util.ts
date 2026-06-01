/**
 * 静态资源（头像、打卡图）存储与解析：
 * - 数据库只存相对路径 `/uploads/avatars/xxx.jpg`，不含域名/网关
 * - 接口返回时按 API_PUBLIC_BASE_URL（或分环境变量）或当前请求动态拼完整 URL
 */

const OUR_UPLOAD_PATH = /^(\/uploads\/(?:avatars|checkins|attractions)\/.+)$/i;
const OUR_UPLOAD_FULL = /^https?:\/\/[^/]+(\/uploads\/(?:avatars|checkins|attractions)\/.+)$/i;

function trimPublicBase(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/$/, '') : null;
}

/**
 * 解析静态资源公网基址，优先级：
 * 1. API_PUBLIC_BASE_URL（显式覆盖）
 * 2. NODE_ENV=production → API_PUBLIC_BASE_URL_PROD
 * 3. API_PUBLIC_BASE_URL_DVE / API_PUBLIC_BASE_URL_DEV
 */
export function resolveApiPublicBaseUrlFromEnv(): string | null {
  const explicit = trimPublicBase(process.env.API_PUBLIC_BASE_URL);
  if (explicit) return explicit;

  if (process.env.NODE_ENV?.trim() === 'production') {
    const prod = trimPublicBase(process.env.API_PUBLIC_BASE_URL_PROD);
    if (prod) return prod;
  }

  const dve = trimPublicBase(process.env.API_PUBLIC_BASE_URL_DVE);
  if (dve) return dve;

  const dev = trimPublicBase(process.env.API_PUBLIC_BASE_URL_DEV);
  if (dev) return dev;

  return null;
}

export function getConfiguredPublicBase(): string | null {
  return resolveApiPublicBaseUrlFromEnv();
}

export function resolvePublicBaseFromRequest(req: {
  protocol: string;
  get: (name: string) => string | undefined;
}): string {
  const fromEnv = getConfiguredPublicBase();
  if (fromEnv) return fromEnv;
  const host = req.get('host');
  return `${req.protocol}://${host}`;
}

/** 是否为外部 CDN/OSS 等完整 URL（非本服务 uploads） */
export function isExternalAssetUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  return !OUR_UPLOAD_FULL.test(value);
}

/**
 * 写入数据库前：本服务 uploads 转为相对路径；外部 URL 原样保留。
 */
export function normalizeStoredAssetPath(value: string | null | undefined): string | null {
  if (value == null || value === '') return value ?? null;

  const trimmed = value.trim();
  if (isExternalAssetUrl(trimmed)) return trimmed;

  const fromFull = trimmed.match(OUR_UPLOAD_FULL);
  if (fromFull) return fromFull[1];

  if (OUR_UPLOAD_PATH.test(trimmed)) return trimmed;

  // 仅文件名（兼容异常数据）
  if (!trimmed.includes('/') && /^[\w.-]+\.(jpg|jpeg|png|webp|gif)$/i.test(trimmed)) {
    return `/uploads/avatars/${trimmed}`;
  }

  return trimmed;
}

export function normalizeStoredAssetPaths(values: string[] | null | undefined): string[] {
  if (!values?.length) return [];
  return values.map((v) => normalizeStoredAssetPath(v) ?? v);
}

export interface ResolvePublicAssetOptions {
  /** 优先于 API_PUBLIC_BASE_URL，常用于单次请求上下文 */
  publicBase?: string;
}

/**
 * 读出接口响应前：相对路径 + 当前公网基址 → 完整 URL。
 */
export function resolvePublicAssetUrl(
  stored: string | null | undefined,
  options?: ResolvePublicAssetOptions,
): string | null {
  if (stored == null || stored === '') return stored ?? null;

  if (isExternalAssetUrl(stored)) return stored;

  const relative = normalizeStoredAssetPath(stored);
  if (!relative || !OUR_UPLOAD_PATH.test(relative)) {
    return stored;
  }

  const base = (options?.publicBase ?? getConfiguredPublicBase())?.replace(/\/$/, '');
  if (!base) return relative;

  return `${base}${relative}`;
}

export function resolvePublicAssetUrls(
  stored: string[] | null | undefined,
  options?: ResolvePublicAssetOptions,
): string[] {
  if (!stored?.length) return [];
  return stored.map((item) => resolvePublicAssetUrl(item, options) ?? item);
}

/** @deprecated 使用 resolvePublicAssetUrl */
export const rewritePublicAssetUrl = resolvePublicAssetUrl;

/** @deprecated 使用 resolvePublicAssetUrls */
export const rewritePublicAssetUrls = resolvePublicAssetUrls;
