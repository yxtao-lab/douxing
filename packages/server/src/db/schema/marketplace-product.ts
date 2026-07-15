import {
  mysqlTable,
  int,
  varchar,
  text,
  decimal,
  timestamp,
  index,
} from 'drizzle-orm/mysql-core';
import { bizOrg } from './marketplace-biz-org.js';

/** 商户标准套餐（标品） */
export const serviceProduct = mysqlTable(
  'service_product',
  {
    id: int('id').primaryKey().autoincrement(),
    orgId: int('org_id')
      .notNull()
      .references(() => bizOrg.id, { onDelete: 'cascade' }),
    categoryCode: varchar('category_code', { length: 64 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    coverUrl: varchar('cover_url', { length: 512 }),
    destination: varchar('destination', { length: 128 }),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    orgIdx: index('idx_service_product_org').on(table.orgId),
    statusIdx: index('idx_service_product_status').on(table.status),
    categoryIdx: index('idx_service_product_category').on(table.categoryCode),
  }),
);

/** 标品 SKU（价格与库存） */
export const serviceProductSku = mysqlTable(
  'service_product_sku',
  {
    id: int('id').primaryKey().autoincrement(),
    productId: int('product_id')
      .notNull()
      .references(() => serviceProduct.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    price: decimal('price', { precision: 12, scale: 2 }).notNull(),
    stock: int('stock').notNull().default(0),
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    productIdx: index('idx_service_product_sku_product').on(table.productId),
  }),
);

export type ServiceProduct = typeof serviceProduct.$inferSelect;
export type NewServiceProduct = typeof serviceProduct.$inferInsert;
export type ServiceProductSku = typeof serviceProductSku.$inferSelect;
export type NewServiceProductSku = typeof serviceProductSku.$inferInsert;
