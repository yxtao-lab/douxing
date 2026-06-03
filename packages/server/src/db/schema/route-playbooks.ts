import {
  mysqlTable,
  varchar,
  text,
  json,
  tinyint,
  int,
  timestamp,
} from 'drizzle-orm/mysql-core';
import type { RoutePlaybookSegmentEdge } from '@douxing/shared';

/** H9+：玩法动线知识库 */
export const routePlaybooks = mysqlTable('route_playbooks', {
  id: varchar('id', { length: 64 }).primaryKey(),
  city: varchar('city', { length: 64 }).notNull(),
  scope: varchar('scope', { length: 128 }).notNull(),
  keywords: json('keywords').$type<string[]>().notNull(),
  themes: json('themes').$type<string[]>().notNull(),
  classicOrder: json('classic_order').$type<string[]>().notNull(),
  segments: json('segments').$type<RoutePlaybookSegmentEdge[]>().notNull(),
  summaryZh: text('summary_zh').notNull(),
  summaryEn: text('summary_en').notNull(),
  enabled: tinyint('enabled').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});
