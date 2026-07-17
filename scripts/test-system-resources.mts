/**
 * 本地验证：远程 Git 系统资源统计。
 *
 * 用法：pnpm exec tsx scripts/test-system-resources.mts
 */
import { getSystemResourcesStats } from '../packages/server/src/services/system-resources.service.ts';

const t0 = Date.now();
const stats = await getSystemResourcesStats(true);
console.log('elapsed_ms', Date.now() - t0);
console.log({
  source: stats.source,
  remoteUrl: stats.remoteUrl,
  branch: stats.branch,
  commitSha: stats.commitSha.slice(0, 10),
  commitAt: stats.commitAt,
  packages: stats.packages.map((p) => ({ name: p.name, files: p.fileCount, lines: p.lineCount })),
  trendDays: stats.commitTrends.length,
  moduleChurnTop: stats.moduleChurn.slice(0, 5),
  overview: stats.overview.map((o) => ({ key: o.labelKey.split('.').pop(), value: o.value })),
});
