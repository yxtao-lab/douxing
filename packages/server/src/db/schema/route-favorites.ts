import { mysqlTable, int, timestamp, uniqueIndex } from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { travelRoutes } from './travel-routes.js';

/** 路线收藏记录 */
export const routeFavorites = mysqlTable(
  'route_favorites',
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
    ukUserRoute: uniqueIndex('uk_route_favorites_user_route').on(table.userId, table.routeId),
  }),
);
