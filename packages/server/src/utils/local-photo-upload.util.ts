import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeStoredAssetPath } from './public-asset-url.util.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const photosUploadRoot = path.resolve(serverRoot, 'uploads/photos');

export function getPhotosUploadRoot(): string {
  return photosUploadRoot;
}

export function getUserPhotosUploadDir(userId: number): string {
  const dir = path.resolve(photosUploadRoot, String(userId));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** 将 DB 相对路径解析为 photos 目录下的绝对路径（防路径穿越） */
export function resolveTravelPhotoAbsPath(storedPath: string | null | undefined): string | null {
  const relative = normalizeStoredAssetPath(storedPath);
  if (!relative) return null;

  const match = relative.match(/^\/uploads\/photos\/(\d+)\/([^/]+)$/i);
  if (!match?.[1] || !match[2]) return null;

  const userId = match[1];
  const filename = match[2];
  if (filename.includes('..')) return null;

  const abs = path.resolve(photosUploadRoot, userId, filename);
  const baseWithSep = `${photosUploadRoot}${path.sep}${userId}${path.sep}`;
  if (!abs.startsWith(baseWithSep)) return null;
  return abs;
}

/** 删除本机旅行照片（失败静默） */
export function tryDeleteTravelPhotoFile(storedPath: string | null | undefined): void {
  const abs = resolveTravelPhotoAbsPath(storedPath);
  if (!abs || !fs.existsSync(abs)) return;

  try {
    fs.unlinkSync(abs);
  } catch (err) {
    console.warn(
      '[uploads] 删除旅行照片失败:',
      storedPath,
      err instanceof Error ? err.message : err,
    );
  }
}
