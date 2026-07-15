import {
  mysqlTable,
  int,
  varchar,
  decimal,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import { bizOrg } from './marketplace-biz-org.js';
import { serviceOrder } from './marketplace-order.js';

/** 商户结算台账（订单 confirmed 后生成待结算） */
export const orgSettlement = mysqlTable(
  'org_settlement',
  {
    id: int('id').primaryKey().autoincrement(),
    orgId: int('org_id')
      .notNull()
      .references(() => bizOrg.id, { onDelete: 'cascade' }),
    orderId: int('order_id')
      .notNull()
      .references(() => serviceOrder.id, { onDelete: 'restrict' }),
    orderNo: varchar('order_no', { length: 32 }).notNull(),
    grossAmount: decimal('gross_amount', { precision: 12, scale: 2 }).notNull(),
    platformFee: decimal('platform_fee', { precision: 12, scale: 2 }).notNull(),
    netAmount: decimal('net_amount', { precision: 12, scale: 2 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    settledAt: timestamp('settled_at'),
  },
  (table) => ({
    orderUnique: uniqueIndex('uk_org_settlement_order').on(table.orderId),
    orgIdx: index('idx_org_settlement_org').on(table.orgId),
    statusIdx: index('idx_org_settlement_status').on(table.status),
  }),
);

export type OrgSettlement = typeof orgSettlement.$inferSelect;
export type NewOrgSettlement = typeof orgSettlement.$inferInsert;
