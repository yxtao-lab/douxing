/**
 * H9-3 扫尾：将 attraction-seeds 中的 openHours 回填到已有景点（仅补空字段）。
 *
 * 用法：
 *   pnpm --filter @douxing/server sync:open-hours
 *   pnpm --filter @douxing/server sync:open-hours -- --dry-run
 */
import '../config/env.js';
import { syncOpenHoursFromSeeds } from '../services/attraction.service.js';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log('[sync-open-hours] start', { dryRun });

  try {
    const result = await syncOpenHoursFromSeeds({ dryRun });
    console.log('[sync-open-hours] done', result);

    if (result.updated === 0 && result.missing > 0) {
      console.log('[sync-open-hours] 提示：部分 seed 景点在库中不存在，可先执行 db:seed');
    }
  } catch (err) {
    console.error('[sync-open-hours] 失败:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
