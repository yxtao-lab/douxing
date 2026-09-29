import {
  mysqlTable,
  int,
  bigint,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { travelRoutes } from './travel-routes.js';

/** U5：路线报错 / 纠错工单（采纳后给贡献者验证积分） */
export const routeReports = mysqlTable(
  'route_reports',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    routeId: int('route_id')
      .notNull()
      .references(() => travelRoutes.id, { onDelete: 'cascade' }),
    reporterUserId: int('reporter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** outdated | dangerous | plagiarism | ad | other */
    reason: varchar('reason', { length: 32 }).notNull(),
    detail: text('detail'),
    /** open | accepted | rejected */
    status: varchar('status', { length: 16 }).notNull().default('open'),
    resolverUserId: int('resolver_user_id').references(() => users.id, { onDelete: 'set null' }),
    resolveNote: varchar('resolve_note', { length: 512 }),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    routeStatusIdx: index('idx_route_reports_route_status').on(table.routeId, table.status),
    reporterIdx: index('idx_route_reports_reporter').on(table.reporterUserId),
    statusIdx: index('idx_route_reports_status').on(table.status),
    openUnique: uniqueIndex('uk_route_reports_reporter_reason').on(
      table.routeId,
      table.reporterUserId,
      table.reason,
    ),
  }),
);

export type RouteReport = typeof routeReports.$inferSelect;
export type NewRouteReport = typeof routeReports.$inferInsert;
