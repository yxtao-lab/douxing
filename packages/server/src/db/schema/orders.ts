import {
  mysqlTable,
  int,
  varchar,
  decimal,
  tinyint,
  timestamp,
  json,
} from 'drizzle-orm/mysql-core';
import { users } from './users.js';

/** 订单表（MVP 简化版） */
export const orders = mysqlTable('orders', {
  id: int('id').primaryKey().autoincrement(),
  orderNo: varchar('order_no', { length: 32 }).notNull().unique(),
  userId: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  orderType: varchar('order_type', { length: 32 }).notNull(),
  productId: int('product_id').notNull(),
  productName: varchar('product_name', { length: 200 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  status: tinyint('status').notNull().default(0),
  productSnapshot: json('product_snapshot').$type<Record<string, unknown>>(),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
