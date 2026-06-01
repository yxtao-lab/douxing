/**
 * 景点封面批量补全（Phase 1+ 入口）。
 * 当前 Phase 0 仅扫描并输出统计，不自动写入。
 */
import { enrichMissingAttractionCovers } from '../services/attraction-image-enricher.service.js';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const result = await enrichMissingAttractionCovers({ limit: 100, dryRun });
  console.log('[attraction-images]', dryRun ? 'dry-run' : 'run', result);
}

main().catch((err) => {
  console.error('[attraction-images]', err);
  process.exit(1);
});
