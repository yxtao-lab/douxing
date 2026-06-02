/**
 * 将 DB 中仍指向本地 uploads 的景点封面迁移至 OSS（需 OSS_ENABLED=true）。
 *
 * 用法：
 *   pnpm --filter @douxing/server migrate:covers-to-oss
 *   pnpm --filter @douxing/server migrate:covers-to-oss -- --dry-run
 *   pnpm --filter @douxing/server migrate:covers-to-oss -- --limit=50
 */
import '../config/env.js';
import fs from 'node:fs';
import { and, isNotNull, like } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { attractions } from '../db/schema/attractions.js';
import { isOssEnabled } from '../config/oss.js';
import {
  persistAttractionCoverBuffer,
} from '../services/attraction-cover-storage.service.js';
import { resolveAttractionCoverAbsPath } from '../utils/local-upload.util.js';
import { updateAttractionCoverImage } from '../services/attraction.service.js';

function parseLimitArg(): number {
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  if (!arg) return 100;
  const value = parseInt(arg.split('=')[1] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 500) : 100;
}

async function main() {
  if (!isOssEnabled()) {
    console.error('[migrate-covers] OSS 未启用，请配置 OSS_ENABLED 与密钥');
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');
  const limit = parseLimitArg();

  const db = getDb();
  const rows = await db
    .select()
    .from(attractions)
    .where(and(isNotNull(attractions.coverImageUrl), like(attractions.coverImageUrl, '/uploads/attractions/%')))
    .limit(limit);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const localPath = row.coverImageUrl;
    if (!localPath) {
      skipped += 1;
      continue;
    }

    const abs = resolveAttractionCoverAbsPath(localPath);
    if (!abs || !fs.existsSync(abs)) {
      console.warn('[migrate-covers] 本地文件不存在:', row.id, localPath);
      skipped += 1;
      continue;
    }

    try {
      const buffer = fs.readFileSync(abs);
      const ext = abs.toLowerCase();
      let contentType = 'image/jpeg';
      if (ext.endsWith('.png')) contentType = 'image/png';
      else if (ext.endsWith('.webp')) contentType = 'image/webp';
      else if (ext.endsWith('.gif')) contentType = 'image/gif';

      const variant = localPath.includes('-wikimedia')
        ? 'wikimedia'
        : localPath.includes('-amap')
          ? 'amap'
          : 'manual';

      if (dryRun) {
        console.log('[migrate-covers] would migrate', row.id, localPath);
        migrated += 1;
        continue;
      }

      const { storedUrl } = await persistAttractionCoverBuffer(row.id, buffer, contentType, variant);
      await updateAttractionCoverImage(row.id, {
        coverImageUrl: storedUrl,
        imageSource: row.imageSource ?? variant,
        imageLicense: row.imageLicense,
        imageAttribution: row.imageAttribution,
      });
      console.log('[migrate-covers] migrated', row.id, '→', storedUrl);
      migrated += 1;
    } catch (err) {
      failed += 1;
      console.warn(
        '[migrate-covers] failed',
        row.id,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log('[migrate-covers] done', {
    scanned: rows.length,
    migrated,
    skipped,
    failed,
    dryRun,
  });
}

main().catch((err) => {
  console.error('[migrate-covers]', err);
  process.exit(1);
});
