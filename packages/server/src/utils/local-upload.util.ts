import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeStoredAssetPath } from './public-asset-url.util.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const attractionsUploadDir = path.resolve(serverRoot, 'uploads/attractions');

/** 将 DB 相对路径解析为 attractions 目录下的绝对路径（防路径穿越） */
export function resolveAttractionCoverAbsPath(storedPath: string | null | undefined): string | null {
  const relative = normalizeStoredAssetPath(storedPath);
  if (!relative) return null;

  const match = relative.match(/^\/uploads\/attractions\/([^/]+)$/i);
  if (!match?.[1]) return null;

  const filename = match[1];
  if (filename.includes('..')) return null;

  const abs = path.resolve(attractionsUploadDir, filename);
  const baseWithSep = `${attractionsUploadDir}${path.sep}`;
  if (!abs.startsWith(baseWithSep)) return null;
  return abs;
}

/** 删除本机 attractions 封面（仅 uploads/attractions 内，失败静默） */
export function tryDeleteAttractionCoverFile(storedPath: string | null | undefined): void {
  const abs = resolveAttractionCoverAbsPath(storedPath);
  if (!abs || !fs.existsSync(abs)) return;

  try {
    fs.unlinkSync(abs);
  } catch (err) {
    console.warn(
      '[uploads] 删除旧封面失败:',
      storedPath,
      err instanceof Error ? err.message : err,
    );
  }
}

/** 删除某景点全部 amap 封面变体（兼容历史 timestamp 文件名） */
export function tryDeleteAmapCoverVariants(attractionId: number): void {
  if (!Number.isFinite(attractionId) || attractionId <= 0) return;
  if (!fs.existsSync(attractionsUploadDir)) return;

  const prefix = `${attractionId}-amap`;
  try {
    for (const name of fs.readdirSync(attractionsUploadDir)) {
      if (name.startsWith(prefix)) {
        tryDeleteAttractionCoverFile(`/uploads/attractions/${name}`);
      }
    }
  } catch (err) {
    console.warn(
      '[uploads] 清理 amap 封面变体失败:',
      attractionId,
      err instanceof Error ? err.message : err,
    );
  }
}

export function getAttractionsUploadDir(): string {
  return attractionsUploadDir;
}
