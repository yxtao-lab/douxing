import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeStoredAssetPath } from './public-asset-url.util.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const videosUploadRoot = path.resolve(serverRoot, 'uploads/videos');

/**
 * 返回路线短视频本地上传根目录。
 *
 * @returns `uploads/videos` 绝对路径
 */
export function getVideosUploadRoot(): string {
  return videosUploadRoot;
}

/**
 * 确保并返回用户视频上传目录。
 *
 * @param userId - 用户 ID
 * @returns `uploads/videos/{userId}` 绝对路径
 */
export function getUserVideosUploadDir(userId: number): string {
  const dir = path.resolve(videosUploadRoot, String(userId));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 将 DB 相对路径解析为 videos 目录下的绝对路径（防路径穿越）。
 *
 * @param storedPath - 数据库存储路径
 * @returns 绝对路径；非法时为 `null`
 */
export function resolveRouteVideoAbsPath(storedPath: string | null | undefined): string | null {
  const relative = normalizeStoredAssetPath(storedPath);
  if (!relative) return null;

  const match = relative.match(/^\/uploads\/videos\/(\d+)\/([^/]+)$/i);
  if (!match?.[1] || !match[2]) return null;

  const userId = match[1];
  const filename = match[2];
  if (filename.includes('..')) return null;

  const abs = path.resolve(videosUploadRoot, userId, filename);
  const baseWithSep = `${videosUploadRoot}${path.sep}${userId}${path.sep}`;
  if (!abs.startsWith(baseWithSep)) return null;
  return abs;
}

/**
 * 删除本机路线短视频（失败静默）。
 *
 * @param storedPath - 数据库存储路径
 */
export function tryDeleteRouteVideoFile(storedPath: string | null | undefined): void {
  const abs = resolveRouteVideoAbsPath(storedPath);
  if (!abs || !fs.existsSync(abs)) return;
  try {
    fs.unlinkSync(abs);
  } catch {
    // 静默
  }
}
