/**
 * 景点封面批量补全（高德 POI 图 → Wikimedia 兜底 → OSS 或本地 uploads）。
 *
 * 用法：
 *   pnpm --filter @douxing/server enrich:attraction-images
 *   pnpm --filter @douxing/server enrich:attraction-images -- --dry-run
 *   pnpm --filter @douxing/server enrich:attraction-images -- --limit=20
 */
import '../config/env.js';
import { enrichMissingAttractionCovers } from '../services/attraction-image-enricher.service.js';

function parseLimitArg(): number | undefined {
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  if (!arg) return undefined;
  const value = parseInt(arg.split('=')[1] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limit = parseLimitArg() ?? 50;

  console.log('[attraction-images] start', { dryRun, limit });
  const result = await enrichMissingAttractionCovers({ limit, dryRun });
  console.log('[attraction-images] done', result);

  if (result.scanned > 0 && result.updated === 0 && result.failed === 0) {
    console.log('[attraction-images] 提示：无可用高德 POI 图或未配置 AMAP_WEB_KEY');
  }
}

main().catch((err) => {
  console.error('[attraction-images]', err);
  process.exit(1);
});
