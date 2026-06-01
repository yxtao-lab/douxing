import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_BYTES = 3 * 1024 * 1024;

function extFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('png')) return '.png';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('gif')) return '.gif';
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
  return '.jpg';
}

function extFromUrl(imageUrl: string): string | null {
  try {
    const pathname = new URL(imageUrl).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      return ext === '.jpeg' ? '.jpg' : ext;
    }
  } catch {
    // ignore invalid URL
  }
  return null;
}

export interface DownloadImageResult {
  filePath: string;
  contentType: string;
  bytes: number;
}

/**
 * 下载远程图片到本地文件（带超时与体积上限）。
 */
export async function downloadImageToFile(
  imageUrl: string,
  destPath: string,
  options?: { timeoutMs?: number; maxBytes?: number },
): Promise<DownloadImageResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(imageUrl, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error(`invalid content-type: ${contentType}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new Error('empty image body');
  }
  if (buffer.byteLength > maxBytes) {
    throw new Error(`image too large: ${buffer.byteLength} bytes`);
  }

  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let finalPath = destPath;
  const ext = path.extname(destPath);
  if (!ext) {
    const resolvedExt = extFromContentType(contentType) || extFromUrl(imageUrl) || '.jpg';
    finalPath = `${destPath}${resolvedExt}`;
  }

  fs.writeFileSync(finalPath, buffer);

  return {
    filePath: finalPath,
    contentType,
    bytes: buffer.byteLength,
  };
}
