import { isAnalyticsRollupJobEnabled, getAnalyticsRollupHour } from '../config/analytics.js';
import {
  getDefaultRollupDate,
  rollupAnalyticsDailyMetricsForDate,
} from '../services/analytics-rollup.service.js';

let timer: ReturnType<typeof setTimeout> | undefined;
let lastRunDate: string | undefined;

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function msUntilNextRollup(): number {
  const now = new Date();
  const next = startOfLocalDay(now);
  next.setHours(getAnalyticsRollupHour(), 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

async function runDailyRollup(): Promise<void> {
  const targetDate = getDefaultRollupDate();
  if (lastRunDate === targetDate) return;

  try {
    const point = await rollupAnalyticsDailyMetricsForDate(targetDate);
    lastRunDate = targetDate;
    console.log(
      `[analytics-rollup] 已汇总 ${targetDate}：用户 ${point.users} / 路线 ${point.routes} / 订单 ${point.orders} / 打卡 ${point.checkins} / 规划 ${point.planSessions}`,
    );
  } catch (err) {
    console.error('[analytics-rollup] 跑批失败', err);
  }
}

function scheduleNextRun(): void {
  const delayMs = msUntilNextRollup();
  timer = setTimeout(() => {
    void runDailyRollup().finally(() => {
      scheduleNextRun();
    });
  }, delayMs);
}

export function startAnalyticsRollupJob(): void {
  if (!isAnalyticsRollupJobEnabled()) {
    console.log('[analytics-rollup] 日汇总定时任务已关闭（ANALYTICS_ROLLUP_ENABLED=false）');
    return;
  }
  if (timer) return;

  scheduleNextRun();
  const hour = getAnalyticsRollupHour();
  console.log(`[analytics-rollup] 日汇总定时任务已启动（每日 ${hour}:00 汇总昨日）`);
}

/** 供测试或手动触发 */
export async function triggerAnalyticsRollupNow(): Promise<void> {
  await runDailyRollup();
}

export function resetAnalyticsRollupJobForTests(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  lastRunDate = undefined;
}

export { formatLocalDate };
