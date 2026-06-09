import { bigint, int, json, mysqlTable, timestamp, varchar, index } from 'drizzle-orm/mysql-core';
import { users } from './users.js';

/** 行为与业务埋点事件表 */
export const analyticsEvents = mysqlTable(
  'analytics_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    eventName: varchar('event_name', { length: 64 }).notNull(),
    eventCategory: varchar('event_category', { length: 32 }).notNull().default('business'),
    userId: int('user_id').references(() => users.id, { onDelete: 'set null' }),
    sessionId: varchar('session_id', { length: 64 }),
    properties: json('properties').$type<Record<string, unknown>>(),
    source: varchar('source', { length: 16 }).notNull().default('server'),
    occurredAt: timestamp('occurred_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    nameTimeIdx: index('idx_analytics_events_name_time').on(table.eventName, table.occurredAt),
    userTimeIdx: index('idx_analytics_events_user_time').on(table.userId, table.occurredAt),
    occurredIdx: index('idx_analytics_events_occurred').on(table.occurredAt),
  }),
);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;
