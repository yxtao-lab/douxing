import { mysqlTable, int, varchar, timestamp, index } from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { travelRoutes } from './travel-routes.js';

/** H10-d：POI 外链讨论（用户提交，跳转第三方平台） */
export const routePoiExternalLinks = mysqlTable(
  'route_poi_external_links',
  {
    id: int('id').primaryKey().autoincrement(),
    routeId: int('route_id')
      .notNull()
      .references(() => travelRoutes.id, { onDelete: 'cascade' }),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dayIndex: int('day_index'),
    attractionId: int('attraction_id'),
    poiName: varchar('poi_name', { length: 128 }),
    title: varchar('title', { length: 128 }).notNull(),
    url: varchar('url', { length: 512 }).notNull(),
    platform: varchar('platform', { length: 32 }).notNull().default('other'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    routePoiIdx: index('idx_route_poi_external_links_route').on(
      table.routeId,
      table.attractionId,
      table.dayIndex,
    ),
  }),
);
