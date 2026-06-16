/**
 * Phase 0：高德 POI 批量同步脚本
 *
 * 用法：
 *   pnpm --filter @douxing/server sync:amap-pois
 *   pnpm --filter @douxing/server sync:amap-pois -- --dry-run
 *   pnpm --filter @douxing/server sync:amap-pois -- --city=杭州 --category=hotel
 */
import '../config/env.js';
import { AttractionCategory } from '@douxing/shared';
import { syncAmapPois } from '../services/amap-poi-sync.service.js';

function parseArg(prefix: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${prefix}=`));
  return hit?.slice(prefix.length + 1);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const cityArg = parseArg('--city');
  const categoryArg = parseArg('--category');

  const categories =
    categoryArg === 'hotel'
      ? [AttractionCategory.HOTEL]
      : categoryArg === 'restaurant'
        ? [AttractionCategory.RESTAURANT]
        : categoryArg === 'attraction'
          ? [AttractionCategory.ATTRACTION]
          : undefined;

  console.log('[sync-amap-pois] start', { dryRun, city: cityArg, category: categoryArg });

  try {
    const result = await syncAmapPois({
      cities: cityArg ? [cityArg] : undefined,
      categories,
      dryRun,
    });
    console.log('[sync-amap-pois] done', result);
  } catch (err) {
    console.error('[sync-amap-pois] 失败:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
