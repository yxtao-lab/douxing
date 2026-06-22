import OSS from 'ali-oss';
import {
  getOssAccessKeyId,
  getOssAccessKeySecret,
  getOssBucket,
  getOssCdnBaseUrl,
  getOssRegion,
  isOssEnabled,
} from '../config/oss.js';

let client: OSS | null = null;

function getOssClient(): OSS {
  if (!client) {
    if (!isOssEnabled()) {
      throw new Error('OSS is not configured');
    }
    client = new OSS({
      region: getOssRegion(),
      accessKeyId: getOssAccessKeyId(),
      accessKeySecret: getOssAccessKeySecret(),
      bucket: getOssBucket(),
    });
  }
  return client;
}

/** 由对象键拼公网 URL（CDN 优先） */
export function buildOssPublicUrl(objectKey: string): string {
  const key = objectKey.replace(/^\//, '');
  const cdn = getOssCdnBaseUrl();
  if (cdn) return `${cdn}/${key}`;

  const bucket = getOssBucket();
  const region = getOssRegion();
  return `https://${bucket}.${region}.aliyuncs.com/${key}`;
}

/** 从已存 URL 解析 OSS 对象键（本 Bucket + CDN 域名） */
export function parseOssObjectKeyFromUrl(url: string): string | null {
  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/^\//, '');
    if (!pathname) return null;

    const cdn = getOssCdnBaseUrl();
    if (cdn) {
      const cdnHost = new URL(cdn).host;
      if (parsed.host === cdnHost) return pathname;
    }

    const bucket = getOssBucket();
    const region = getOssRegion();
    const bucketHost = `${bucket}.${region}.aliyuncs.com`;
    if (parsed.host === bucketHost) return pathname;
  } catch {
    return null;
  }

  return null;
}

export async function headOssObject(objectKey: string): Promise<{ size: number; lastModified?: Date } | null> {
  if (!isOssEnabled()) return null;
  const oss = getOssClient();
  const key = objectKey.replace(/^\//, '');
  try {
    const meta = await oss.head(key);
    const headers = meta.res.headers as Record<string, string | number | undefined>;
    return {
      size: Number(headers['content-length'] ?? 0),
      lastModified: headers['last-modified']
        ? new Date(String(headers['last-modified']))
        : undefined,
    };
  } catch {
    return null;
  }
}

export async function uploadBufferToOss(
  objectKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const oss = getOssClient();
  const key = objectKey.replace(/^\//, '');
  await oss.put(key, buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    },
  });
  return buildOssPublicUrl(key);
}

/** 上传本地文件至 OSS（ML 数据集等） */
export async function uploadLocalFileToOss(
  localPath: string,
  objectKey: string,
  contentType = 'application/jsonl',
): Promise<string> {
  const { readFileSync } = await import('node:fs');
  const buffer = readFileSync(localPath);
  return uploadBufferToOss(objectKey, buffer, contentType);
}

export async function deleteOssObject(objectKey: string): Promise<void> {
  if (!isOssEnabled()) return;
  const oss = getOssClient();
  const key = objectKey.replace(/^\//, '');
  try {
    await oss.delete(key);
  } catch (err) {
    console.warn(
      '[oss] 删除对象失败:',
      key,
      err instanceof Error ? err.message : err,
    );
  }
}

export async function deleteOssObjectByUrl(url: string): Promise<void> {
  const key = parseOssObjectKeyFromUrl(url);
  if (key) await deleteOssObject(key);
}

/** 列出指定前缀下全部对象键 */
export async function listOssObjectKeys(prefix: string): Promise<string[]> {
  if (!isOssEnabled()) return [];
  const oss = getOssClient();
  const normalized = prefix.replace(/^\//, '');
  const keys: string[] = [];
  let marker: string | undefined;

  do {
    const result = await oss.list({ prefix: normalized, marker, 'max-keys': 1000 }, {});
    for (const obj of result.objects ?? []) {
      if (obj.name) keys.push(obj.name);
    }
    marker = result.isTruncated ? result.nextMarker : undefined;
  } while (marker);

  return keys;
}
