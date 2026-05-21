import {
  mysqlTable,
  int,
  varchar,
  text,
  tinyint,
  timestamp,
  json,
} from 'drizzle-orm/mysql-core';
import { users } from './users.js';

/** 路线表 */
export const travelRoutes = mysqlTable('travel_routes', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  /** 预算范围，如 "3000-8000" */
  budgetRange: varchar('budget_range', { length: 64 }),
  days: int('days').notNull().default(1),
  interestTags: json('interest_tags').$type<string[]>(),
  routeDetail: json('route_detail').$type<Record<string, unknown>>(),
  creatorId: int('creator_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  viewCount: int('view_count').notNull().default(0),
  likeCount: int('like_count').notNull().default(0),
  collectCount: int('collect_count').notNull().default(0),
  commentCount: int('comment_count').notNull().default(0),
  /** 是否公开到广场（1=所有人可见并可互动） */
  isPublic: tinyint('is_public').notNull().default(0),
  status: tinyint('status').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export type TravelRoute = typeof travelRoutes.$inferSelect;
export type NewTravelRoute = typeof travelRoutes.$inferInsert;
