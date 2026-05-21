import { mysqlTable, int, timestamp, uniqueIndex } from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { travelRoutes } from './travel-routes.js';

/** 路线点赞记录 */
export const routeLikes = mysqlTable(
  'route_likes',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    routeId: int('route_id')
      .notNull()
      .references(() => travelRoutes.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    ukUserRoute: uniqueIndex('uk_route_likes_user_route').on(table.userId, table.routeId),
  }),
);
