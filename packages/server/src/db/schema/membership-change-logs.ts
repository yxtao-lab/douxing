import { mysqlTable, int, varchar, tinyint, timestamp } from 'drizzle-orm/mysql-core';
import { users } from './users.js';

/** 会员等级变更日志 */
export const membershipChangeLogs = mysqlTable('membership_change_logs', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  fromLevel: tinyint('from_level').notNull().default(0),
  toLevel: tinyint('to_level').notNull().default(0),
  source: varchar('source', { length: 32 }).notNull(),
  remark: varchar('remark', { length: 500 }),
  orderId: int('order_id'),
  operatorId: int('operator_id'),
  memberExpiresAt: timestamp('member_expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type MembershipChangeLogRow = typeof membershipChangeLogs.$inferSelect;
