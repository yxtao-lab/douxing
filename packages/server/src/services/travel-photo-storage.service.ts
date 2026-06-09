import fs from 'node:fs';
import path from 'node:path';
import { getOssPhotosPrefix, isOssEnabled } from '../config/oss.js';
import { getUserPhotosUploadDir, tryDeleteTravelPhotoFile } from '../utils/local-photo-upload.util.js';
import { deleteOssObjectByUrl, uploadBufferToOss } from './oss-storage.service.js';

function extFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('png')) return '.png';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('gif')) return '.gif';
  return '.jpg';
}

function buildLocalFilename(ext: string): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
}

function buildOssObjectKey(userId: number, ext: string): string {
  const prefix = getOssPhotosPrefix();
  return `${prefix}${userId}/${buildLocalFilename(ext)}`;
}

export interface PersistTravelPhotoResult {
  /** 写入 DB 的值：相对路径或 OSS/CDN 完整 URL */
  storedUrl: string;
}

/**
 * 将旅行照片二进制持久化：OSS 启用时上传对象存储，否则写本地 uploads/photos/{userId}/。
 */
export async function persistTravelPhotoBuffer(
  userId: number,
  buffer: Buffer,
  contentType: string,
): Promise<PersistTravelPhotoResult> {
  const ext = extFromContentType(contentType);

  if (isOssEnabled()) {
    const objectKey = buildOssObjectKey(userId, ext);
    const publicUrl = await uploadBufferToOss(objectKey, buffer, contentType);
    return { storedUrl: publicUrl };
  }

  const dir = getUserPhotosUploadDir(userId);
  const filename = buildLocalFilename(ext);
  const absPath = path.join(dir, filename);
  fs.writeFileSync(absPath, buffer);

  return { storedUrl: `/uploads/photos/${userId}/${filename}` };
}

/** 删除已存旅行照片（本地相对路径或 OSS URL） */
export async function deleteStoredTravelPhoto(storedUrl: string | null | undefined): Promise<void> {
  if (!storedUrl?.trim()) return;

  if (/^https?:\/\//i.test(storedUrl)) {
    await deleteOssObjectByUrl(storedUrl);
    return;
  }

  tryDeleteTravelPhotoFile(storedUrl);
}
