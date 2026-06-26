/**
 * DT2 · 指标日汇总 CLI
 *
 * 用法：
 *   pnpm analytics:rollup                         # 汇总昨日
 *   pnpm analytics:rollup -- --date 2026-06-01    # 指定日期
 *   pnpm analytics:rollup -- --backfill 90        # 回填最近 90 天（不含今日）
 */
import '../config/env.js';
import {
  backfillAnalyticsDailyMetrics,
  getDefaultRollupDate,
  rollupAnalyticsDailyMetricsForDate,
} from '../services/analytics-rollup.service.js';

function parseArgs(argv: string[]) {
  let date: string | undefined;
  let backfill: number | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--date' && next) {
      date = next;
      i += 1;
    } else if (arg === '--backfill' && next) {
      backfill = Number(next);
      i += 1;
    }
  }

  return { date, backfill };
}

async function main() {
  const { date, backfill } = parseArgs(process.argv.slice(2));

  if (backfill !== undefined) {
    if (!Number.isFinite(backfill) || backfill < 1) {
      console.error('[analytics-rollup] --backfill 须为正整数');
      process.exit(1);
    }
    const rolled = await backfillAnalyticsDailyMetrics(backfill);
    console.log(`[analytics-rollup] 已回填 ${rolled} 天`);
    return;
  }

  const targetDate = date ?? getDefaultRollupDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    console.error('[analytics-rollup] --date 格式须为 YYYY-MM-DD');
    process.exit(1);
  }

  const point = await rollupAnalyticsDailyMetricsForDate(targetDate);
  console.log(
    `[analytics-rollup] ${targetDate}：用户 ${point.users} / 路线 ${point.routes} / 订单 ${point.orders} / 打卡 ${point.checkins} / 规划 ${point.planSessions}`,
  );
}

main().catch((err) => {
  console.error('[analytics-rollup] 执行失败', err);
  process.exit(1);
});
