import { mysqlTable, int, varchar, timestamp, index } from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { travelRoutes } from './travel-routes.js';

/** H10-b：路线/POI 绑定 UGC 短视频 */
export const routeMedia = mysqlTable(
  'route_media',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    routeId: int('route_id')
      .notNull()
      .references(() => travelRoutes.id, { onDelete: 'cascade' }),
    /** route=整线视频；poi=单站视频 */
    scope: varchar('scope', { length: 8 }).notNull(),
    dayIndex: int('day_index'),
    attractionId: int('attraction_id'),
    poiName: varchar('poi_name', { length: 128 }),
    storedVideoUrl: varchar('stored_video_url', { length: 512 }).notNull(),
    coverUrl: varchar('cover_url', { length: 512 }),
    durationSec: int('duration_sec').notNull(),
    byteSize: int('byte_size').notNull(),
    /** CheckInStatus：0 待审 / 1 通过 / 2 拒绝 */
    status: int('status').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    routeStatusIdx: index('idx_route_media_route').on(table.routeId, table.status),
    poiIdx: index('idx_route_media_poi').on(
      table.routeId,
      table.attractionId,
      table.dayIndex,
      table.status,
    ),
  }),
);
