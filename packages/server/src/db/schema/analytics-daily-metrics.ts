import { bigint, date, int, mysqlTable, timestamp, uniqueIndex, index } from 'drizzle-orm/mysql-core';

/** DT2 · 指标日汇总表（T+1 跑批写入，趋势 API 优先读取） */
export const analyticsDailyMetrics = mysqlTable(
  'analytics_daily_metrics',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    metricDate: date('metric_date', { mode: 'string' }).notNull(),
    usersNew: int('users_new').notNull().default(0),
    routesNew: int('routes_new').notNull().default(0),
    ordersNew: int('orders_new').notNull().default(0),
    checkinsNew: int('checkins_new').notNull().default(0),
    planSessionsNew: int('plan_sessions_new').notNull().default(0),
    rolledUpAt: timestamp('rolled_up_at').notNull().defaultNow(),
  },
  (table) => ({
    dateUnique: uniqueIndex('uk_analytics_daily_metrics_date').on(table.metricDate),
    dateIdx: index('idx_analytics_daily_metrics_date').on(table.metricDate),
  }),
);

export type AnalyticsDailyMetric = typeof analyticsDailyMetrics.$inferSelect;
export type NewAnalyticsDailyMetric = typeof analyticsDailyMetrics.$inferInsert;
