import { mysqlTable, int, varchar, timestamp, index } from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { travelRoutes } from './travel-routes.js';

/** 路线评论 */
export const routeComments = mysqlTable(
  'route_comments',
  {
    id: int('id').primaryKey().autoincrement(),
    routeId: int('route_id')
      .notNull()
      .references(() => travelRoutes.id, { onDelete: 'cascade' }),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: varchar('content', { length: 500 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    routeCreatedIdx: index('idx_route_comments_route_created').on(table.routeId, table.createdAt),
  }),
);
