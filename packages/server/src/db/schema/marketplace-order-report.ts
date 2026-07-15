import {
  mysqlTable,
  int,
  varchar,
  text,
  json,
  decimal,
  timestamp,
  index,
} from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { serviceOrder } from './marketplace-order.js';

/** 服务订单履约汇报（行中签到 / 图文；M7-4） */
export const serviceOrderReport = mysqlTable(
  'service_order_report',
  {
    id: int('id').primaryKey().autoincrement(),
    orderId: int('order_id')
      .notNull()
      .references(() => serviceOrder.id, { onDelete: 'cascade' }),
    authorUserId: int('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reportType: varchar('report_type', { length: 16 }).notNull(),
    content: text('content'),
    photos: json('photos').$type<string[] | null>(),
    latitude: decimal('latitude', { precision: 10, scale: 7 }),
    longitude: decimal('longitude', { precision: 10, scale: 7 }),
    placeName: varchar('place_name', { length: 256 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    orderIdx: index('idx_service_order_report_order').on(table.orderId),
    authorIdx: index('idx_service_order_report_author').on(table.authorUserId),
  }),
);

export type ServiceOrderReport = typeof serviceOrderReport.$inferSelect;
export type NewServiceOrderReport = typeof serviceOrderReport.$inferInsert;
