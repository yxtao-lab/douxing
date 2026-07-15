import {
  mysqlTable,
  int,
  varchar,
  decimal,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { bizOrg } from './marketplace-biz-org.js';
import { serviceDemand, demandQuote } from './marketplace-demand.js';
import { serviceProduct, serviceProductSku } from './marketplace-product.js';

/** 服务履约订单（模块 B，与路线解锁 orders 分表） */
export const serviceOrder = mysqlTable(
  'service_order',
  {
    id: int('id').primaryKey().autoincrement(),
    orderNo: varchar('order_no', { length: 32 }).notNull(),
    /** 发单成单必填；标品直购为 null */
    demandId: int('demand_id').references(() => serviceDemand.id, { onDelete: 'restrict' }),
    quoteId: int('quote_id').references(() => demandQuote.id, { onDelete: 'set null' }),
    /** 标品直购必填；发单成单为 null */
    productId: int('product_id').references(() => serviceProduct.id, { onDelete: 'set null' }),
    skuId: int('sku_id').references(() => serviceProductSku.id, { onDelete: 'set null' }),
    buyerUserId: int('buyer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    sellerOrgId: int('seller_org_id').references(() => bizOrg.id, { onDelete: 'set null' }),
    sellerProviderUserId: int('seller_provider_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
    platformFee: decimal('platform_fee', { precision: 12, scale: 2 }).notNull().default('0.00'),
    status: varchar('status', { length: 16 }).notNull().default('pending_pay'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    orderNoUnique: uniqueIndex('uk_service_order_no').on(table.orderNo),
    demandIdx: index('idx_service_order_demand').on(table.demandId),
    productIdx: index('idx_service_order_product').on(table.productId),
    buyerIdx: index('idx_service_order_buyer').on(table.buyerUserId),
  }),
);

export type ServiceOrder = typeof serviceOrder.$inferSelect;
export type NewServiceOrder = typeof serviceOrder.$inferInsert;
