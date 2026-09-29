import {
  mysqlTable,
  int,
  bigint,
  varchar,
  timestamp,
  json,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { users } from './users.js';

/** G-INCENTIVE-01：验证积分兑换记录（可审计） */
export const pointRedemptions = mysqlTable(
  'point_redemptions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: varchar('product_id', { length: 64 }).notNull(),
    pointsSpent: int('points_spent').notNull(),
    /** 幂等键：clientRequestId 或系统生成 */
    dedupeKey: varchar('dedupe_key', { length: 191 }).notNull(),
    meta: json('meta').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    dedupeUnique: uniqueIndex('uk_point_redemptions_dedupe').on(table.dedupeKey),
    userTimeIdx: index('idx_point_redemptions_user_time').on(table.userId, table.createdAt),
    productIdx: index('idx_point_redemptions_product').on(table.productId),
  }),
);

export type PointRedemption = typeof pointRedemptions.$inferSelect;
export type NewPointRedemption = typeof pointRedemptions.$inferInsert;
