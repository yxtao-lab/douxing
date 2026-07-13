/**
 * 将 DEFAULT_MENU_SEED 中缺失的 sys_menu 写入库，并同步 icon / sortOrder。
 *
 * 用法：pnpm --filter @douxing/server db:sync-menus
 */
import '../config/env.js';
import { syncMissingMenusFromSeed } from '../services/sys-admin.service.js';

async function main() {
  await syncMissingMenusFromSeed();
  console.log('[sync-menus] 完成');
  process.exit(0);
}

main().catch((err) => {
  console.error('[sync-menus] 失败:', err);
  process.exit(1);
});
