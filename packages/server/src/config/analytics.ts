/** DT2 · 指标日汇总跑批配置 */

export function isAnalyticsRollupJobEnabled(): boolean {
  return process.env.ANALYTICS_ROLLUP_ENABLED !== 'false';
}

/** 每日跑批小时（本地时区，默认 2 点） */
export function getAnalyticsRollupHour(): number {
  const raw = Number(process.env.ANALYTICS_ROLLUP_HOUR ?? 2);
  if (!Number.isFinite(raw)) return 2;
  return Math.min(23, Math.max(0, Math.floor(raw)));
}
