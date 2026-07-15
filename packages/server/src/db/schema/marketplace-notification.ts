import { mysqlTable, int, varchar, timestamp, json, index } from 'drizzle-orm/mysql-core';
import { users } from './users.js';

/**
 * 发单接单站内通知（M4 简化表；G3 统一收件箱就绪后可迁移合并）。
 */
export const marketplaceNotification = mysqlTable(
  'marketplace_notification',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 通知类型，如 demand_match */
    type: varchar('type', { length: 32 }).notNull(),
    /** 关联实体类型，如 service_demand */
    refType: varchar('ref_type', { length: 32 }).notNull(),
    refId: int('ref_id').notNull(),
    /** ApiMessageKey 字符串，客户端按 locale 解析 */
    messageKey: varchar('message_key', { length: 128 }).notNull(),
    /** 模板参数与匹配分等扩展字段 */
    payload: json('payload').$type<Record<string, string | number | null> | null>(),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_marketplace_notification_user').on(table.userId),
    userUnreadIdx: index('idx_marketplace_notification_user_read').on(table.userId, table.readAt),
    refIdx: index('idx_marketplace_notification_ref').on(table.refType, table.refId),
  }),
);

export type MarketplaceNotification = typeof marketplaceNotification.$inferSelect;
export type NewMarketplaceNotification = typeof marketplaceNotification.$inferInsert;
