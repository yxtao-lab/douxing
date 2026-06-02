/**
 * 清理 uploads/attractions 中未被 DB 引用的孤儿封面文件。
 *
 * 用法：
 *   pnpm --filter @douxing/server cleanup:orphan-covers
 *   pnpm --filter @douxing/server cleanup:orphan-covers -- --dry-run
 */
import '../config/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { isNotNull } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { attractions } from '../db/schema/attractions.js';
import { isOssEnabled } from '../config/oss.js';
import {
  coverStorageKey,
  listLocalAttractionCoverFiles,
  getOssAttractionsPrefix,
} from '../services/attraction-cover-storage.service.js';
import { deleteOssObject, listOssObjectKeys } from '../services/oss-storage.service.js';
import { getAttractionsUploadDir } from '../utils/local-upload.util.js';

async function collectReferencedKeys(): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ coverImageUrl: attractions.coverImageUrl })
    .from(attractions)
    .where(isNotNull(attractions.coverImageUrl));

  const keys = new Set<string>();
  for (const row of rows) {
    const key = coverStorageKey(row.coverImageUrl);
    if (key) keys.add(key);
  }
  return keys;
}

async function cleanupLocalOrphans(dryRun: boolean): Promise<{ scanned: number; deleted: number }> {
  const referenced = await collectReferencedKeys();
  const files = listLocalAttractionCoverFiles();
  let deleted = 0;

  for (const name of files) {
    if (referenced.has(name)) continue;
    const abs = path.join(getAttractionsUploadDir(), name);
    if (dryRun) {
      console.log('[orphan-covers] would delete local:', name);
    } else {
      try {
        fs.unlinkSync(abs);
        console.log('[orphan-covers] deleted local:', name);
      } catch (err) {
        console.warn('[orphan-covers] delete failed:', name, err instanceof Error ? err.message : err);
        continue;
      }
    }
    deleted += 1;
  }

  return { scanned: files.length, deleted };
}

async function cleanupOssOrphans(dryRun: boolean): Promise<{ scanned: number; deleted: number }> {
  if (!isOssEnabled()) return { scanned: 0, deleted: 0 };

  const referenced = await collectReferencedKeys();
  const prefix = getOssAttractionsPrefix();
  const keys = await listOssObjectKeys(prefix);
  let deleted = 0;

  for (const key of keys) {
    const basename = path.basename(key);
    if (referenced.has(basename)) continue;

    if (dryRun) {
      console.log('[orphan-covers] would delete oss:', key);
    } else {
      await deleteOssObject(key);
      console.log('[orphan-covers] deleted oss:', key);
    }
    deleted += 1;
  }

  return { scanned: keys.length, deleted };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log('[orphan-covers] start', { dryRun, oss: isOssEnabled() });

  const local = await cleanupLocalOrphans(dryRun);
  const oss = await cleanupOssOrphans(dryRun);

  console.log('[orphan-covers] done', {
    localScanned: local.scanned,
    localDeleted: local.deleted,
    ossScanned: oss.scanned,
    ossDeleted: oss.deleted,
  });
}

main().catch((err) => {
  console.error('[orphan-covers]', err);
  process.exit(1);
});
