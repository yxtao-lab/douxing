import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const marketplaceDocsRoot = path.resolve(serverRoot, 'uploads/marketplace');

/** marketplace 资质附件最大字节数（10MB） */
export const MARKETPLACE_DOC_MAX_BYTES = 10 * 1024 * 1024;

/**
 * 获取 marketplace 资质附件本地上传根目录。
 *
 * @returns 绝对路径
 */
export function getMarketplaceDocsUploadRoot(): string {
  if (!fs.existsSync(marketplaceDocsRoot)) {
    fs.mkdirSync(marketplaceDocsRoot, { recursive: true });
  }
  return marketplaceDocsRoot;
}

/**
 * 将资质附件二进制写入本机 uploads/marketplace 目录。
 *
 * @param userId - 上传用户 ID，用于子目录隔离
 * @param originalName - 原始文件名（仅用于扩展名推断）
 * @param buffer - 文件内容
 * @param mimeType - MIME 类型
 * @returns 数据库存储的相对路径，形如 `/uploads/marketplace/{userId}/{filename}`
 */
export function saveMarketplaceDocumentLocal(
  userId: number,
  originalName: string,
  buffer: Buffer,
  mimeType: string,
): string {
  const ext = resolveMarketplaceDocExtension(originalName, mimeType);
  const filename = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
  const userDir = path.resolve(getMarketplaceDocsUploadRoot(), String(userId));
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  const absPath = path.resolve(userDir, filename);
  fs.writeFileSync(absPath, buffer);
  return `/uploads/marketplace/${userId}/${filename}`;
}

/**
 * 根据文件名与 MIME 推断安全扩展名。
 *
 * @param originalName - 原始文件名
 * @param mimeType - MIME 类型
 * @returns 带点扩展名，默认 `.bin`
 */
function resolveMarketplaceDocExtension(originalName: string, mimeType: string): string {
  const fromName = path.extname(originalName).toLowerCase();
  if (fromName && fromName.length <= 8) return fromName;

  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  };
  return mimeMap[mimeType] ?? '.bin';
}
