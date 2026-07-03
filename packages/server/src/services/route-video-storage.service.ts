import fs from 'node:fs';
import path from 'node:path';
import { getOssVideosPrefix, isOssEnabled } from '../config/oss.js';
import { getUserVideosUploadDir, tryDeleteRouteVideoFile } from '../utils/local-video-upload.util.js';
import { deleteOssObjectByUrl, uploadBufferToOss } from './oss-storage.service.js';

/**
 * 根据 Content-Type 推断视频扩展名。
 *
 * @param contentType - MIME 类型
 * @returns 文件扩展名（含点）
 */
function extFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('quicktime')) return '.mov';
  if (ct.includes('webm')) return '.webm';
  return '.mp4';
}

/**
 * 生成本地/OSS 共用的随机文件名。
 *
 * @param ext - 扩展名
 * @returns 文件名
 */
function buildFilename(ext: string): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
}

/**
 * 构建 OSS 对象键。
 *
 * @param userId - 上传用户 ID
 * @param ext - 扩展名
 * @returns OSS object key
 */
function buildOssObjectKey(userId: number, ext: string): string {
  const prefix = getOssVideosPrefix();
  return `${prefix}${userId}/${buildFilename(ext)}`;
}

export interface PersistRouteVideoResult {
  /** 写入 DB 的值：相对路径或 OSS/CDN 完整 URL */
  storedUrl: string;
}

/**
 * 将路线短视频二进制持久化：OSS 启用时上传对象存储，否则写本地 `uploads/videos/{userId}/`。
 *
 * @param userId - 上传用户 ID
 * @param buffer - 视频二进制
 * @param contentType - MIME 类型
 * @returns 持久化后的存储地址
 */
export async function persistRouteVideoBuffer(
  userId: number,
  buffer: Buffer,
  contentType: string,
): Promise<PersistRouteVideoResult> {
  const ext = extFromContentType(contentType);

  if (isOssEnabled()) {
    const objectKey = buildOssObjectKey(userId, ext);
    const publicUrl = await uploadBufferToOss(objectKey, buffer, contentType);
    return { storedUrl: publicUrl };
  }

  const dir = getUserVideosUploadDir(userId);
  const filename = buildFilename(ext);
  const absPath = path.join(dir, filename);
  fs.writeFileSync(absPath, buffer);

  return { storedUrl: `/uploads/videos/${userId}/${filename}` };
}

/**
 * 删除已存路线短视频（本地相对路径或 OSS URL）。
 *
 * @param storedUrl - 数据库存储地址
 */
export async function deleteStoredRouteVideo(storedUrl: string | null | undefined): Promise<void> {
  if (!storedUrl?.trim()) return;

  if (/^https?:\/\//i.test(storedUrl)) {
    await deleteOssObjectByUrl(storedUrl);
    return;
  }

  tryDeleteRouteVideoFile(storedUrl);
}
