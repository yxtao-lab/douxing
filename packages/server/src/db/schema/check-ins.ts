import { mysqlTable, int, varchar, tinyint, timestamp, json } from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { travelRoutes } from './travel-routes.js';

export type CheckInLocation = {
  latitude?: number;
  longitude?: number;
  address?: string;
  placeName?: string;
};

/** 打卡记录表 */
export const checkIns = mysqlTable('check_ins', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  routeId: int('route_id')
    .notNull()
    .references(() => travelRoutes.id, { onDelete: 'cascade' }),
  location: json('location').$type<CheckInLocation>().notNull(),
  checkedAt: timestamp('checked_at').notNull().defaultNow(),
  status: tinyint('status').notNull().default(0),
  remark: varchar('remark', { length: 512 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export type CheckIn = typeof checkIns.$inferSelect;
export type NewCheckIn = typeof checkIns.$inferInsert;
