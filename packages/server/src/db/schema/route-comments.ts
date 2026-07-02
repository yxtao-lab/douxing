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
    /** H10-a：关联行程天（0-based），可空表示路线级评论 */
    dayIndex: int('day_index'),
    /** H10-a：关联景点库 ID */
    attractionId: int('attraction_id'),
    /** H10-a：关联 POI 名称（无 attractionId 时兜底） */
    poiName: varchar('poi_name', { length: 128 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    routeCreatedIdx: index('idx_route_comments_route_created').on(table.routeId, table.createdAt),
    routePoiIdx: index('idx_route_comments_poi').on(
      table.routeId,
      table.attractionId,
      table.dayIndex,
    ),
  }),
);
