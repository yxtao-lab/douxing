import fs from 'node:fs';
import path from 'node:path';
import {
  getOssAttractionsPrefix,
  isOssEnabled,
} from '../config/oss.js';
import { downloadImageToBuffer, downloadImageToFile } from '../utils/download-asset.util.js';
import {
  getAttractionsUploadDir,
  resolveAttractionCoverAbsPath,
  tryDeleteAttractionCoverFile,
} from '../utils/local-upload.util.js';
import {
  deleteOssObject,
  deleteOssObjectByUrl,
  listOssObjectKeys,
  parseOssObjectKeyFromUrl,
  uploadBufferToOss,
} from './oss-storage.service.js';

export type AttractionCoverVariant = 'amap' | 'wikimedia' | 'manual';

function extFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('png')) return '.png';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('gif')) return '.gif';
  return '.jpg';
}

function buildLocalFilename(attractionId: number, variant: AttractionCoverVariant, ext: string): string {
  if (variant === 'manual') {
    return `${attractionId}-manual-${Date.now()}${ext}`;
  }
  return `${attractionId}-${variant}${ext}`;
}

function buildOssObjectKey(attractionId: number, variant: AttractionCoverVariant, ext: string): string {
  const prefix = getOssAttractionsPrefix();
  if (variant === 'manual') {
    return `${prefix}${attractionId}-manual-${Date.now()}${ext}`;
  }
  return `${prefix}${attractionId}-${variant}${ext}`;
}

export interface PersistCoverResult {
  /** 写入 DB 的值：相对路径或 OSS/CDN 完整 URL */
  storedUrl: string;
}

/**
 * 将封面二进制持久化：OSS 启用时上传对象存储，否则写本地 uploads/attractions。
 */
export async function persistAttractionCoverBuffer(
  attractionId: number,
  buffer: Buffer,
  contentType: string,
  variant: AttractionCoverVariant,
): Promise<PersistCoverResult> {
  const ext = extFromContentType(contentType);

  if (isOssEnabled()) {
    const objectKey = buildOssObjectKey(attractionId, variant, ext);
    const publicUrl = await uploadBufferToOss(objectKey, buffer, contentType);
    return { storedUrl: publicUrl };
  }

  const dir = getAttractionsUploadDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filename = buildLocalFilename(attractionId, variant, ext);
  const absPath = path.join(dir, filename);
  fs.writeFileSync(absPath, buffer);

  return { storedUrl: `/uploads/attractions/${filename}` };
}

/**
 * 下载远程图片并持久化（高德 / Wikimedia 等）。
 */
export async function persistAttractionCoverFromRemote(
  attractionId: number,
  remoteUrl: string,
  variant: AttractionCoverVariant,
): Promise<PersistCoverResult> {
  await tryDeleteCoverVariants(attractionId, variant);

  if (isOssEnabled()) {
    const { buffer, contentType } = await downloadImageToBuffer(remoteUrl);
    return persistAttractionCoverBuffer(attractionId, buffer, contentType, variant);
  }

  const baseName = `${attractionId}-${variant}`;
  const destWithoutExt = path.join(getAttractionsUploadDir(), baseName);
  const downloaded = await downloadImageToFile(remoteUrl, destWithoutExt);
  const filename = path.basename(downloaded.filePath);
  return { storedUrl: `/uploads/attractions/${filename}` };
}

/** 删除已存封面（本地相对路径或 OSS URL） */
export async function deleteStoredAttractionCover(storedUrl: string | null | undefined): Promise<void> {
  if (!storedUrl?.trim()) return;

  if (/^https?:\/\//i.test(storedUrl)) {
    await deleteOssObjectByUrl(storedUrl);
    return;
  }

  tryDeleteAttractionCoverFile(storedUrl);
}

/** 删除某景点指定来源的全部封面变体（含历史 timestamp 文件名） */
export async function tryDeleteCoverVariants(
  attractionId: number,
  variant: AttractionCoverVariant,
): Promise<void> {
  if (!Number.isFinite(attractionId) || attractionId <= 0) return;

  const filePrefix = `${attractionId}-${variant}`;

  if (isOssEnabled()) {
    const ossPrefix = getOssAttractionsPrefix();
    const keys = await listOssObjectKeys(`${ossPrefix}${filePrefix}`);
    await Promise.all(keys.map((key) => deleteOssObject(key)));
    return;
  }

  const dir = getAttractionsUploadDir();
  if (!fs.existsSync(dir)) return;

  try {
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith(filePrefix)) {
        tryDeleteAttractionCoverFile(`/uploads/attractions/${name}`);
      }
    }
  } catch (err) {
    console.warn(
      '[uploads] 清理封面变体失败:',
      attractionId,
      variant,
      err instanceof Error ? err.message : err,
    );
  }
}

/** 列出本地 uploads/attractions 下全部文件名 */
export function listLocalAttractionCoverFiles(): string[] {
  const dir = getAttractionsUploadDir();
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir).filter((name) => !name.startsWith('.'));
  } catch {
    return [];
  }
}

/** 从 DB 存值提取可比对键（本地文件名或 OSS object basename） */
export function coverStorageKey(storedUrl: string | null | undefined): string | null {
  if (!storedUrl?.trim()) return null;

  if (/^https?:\/\//i.test(storedUrl)) {
    const key = parseOssObjectKeyFromUrl(storedUrl);
    return key ? path.basename(key) : null;
  }

  const abs = resolveAttractionCoverAbsPath(storedUrl);
  return abs ? path.basename(abs) : null;
}

export { getOssAttractionsPrefix, listOssObjectKeys };
