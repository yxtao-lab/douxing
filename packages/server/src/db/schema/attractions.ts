import {
  mysqlTable,
  int,
  varchar,
  text,
  tinyint,
  timestamp,
  json,
  decimal,
  index,
} from 'drizzle-orm/mysql-core';

/** 景点/内容基础库 */
export const attractions = mysqlTable(
  'attractions',
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 128 }).notNull(),
    /** attraction | restaurant | hotel */
    category: varchar('category', { length: 16 }).notNull().default('attraction'),
    city: varchar('city', { length: 64 }).notNull(),
    cityCode: varchar('city_code', { length: 32 }).notNull(),
    latitude: decimal('latitude', { precision: 10, scale: 7 }),
    longitude: decimal('longitude', { precision: 10, scale: 7 }),
    tags: json('tags').$type<string[]>().notNull(),
    description: text('description'),
    ticketPrice: int('ticket_price').notNull().default(0),
    aliases: json('aliases').$type<string[]>(),
    /** 0 禁用 1 已发布 2 待审核（AI 同步） */
    status: tinyint('status').notNull().default(1),
    /** seed | llm | manual | amap */
    source: varchar('source', { length: 16 }).notNull().default('seed'),
    /** seed | llm_estimate | manual | external */
    priceSource: varchar('price_source', { length: 32 }),
    /** 最近一次名称匹配置信度（同步时写入） */
    matchConfidence: decimal('match_confidence', { precision: 4, scale: 3 }),
    priceUpdatedAt: timestamp('price_updated_at'),
    verifiedAt: timestamp('verified_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    cityIdx: index('idx_attractions_city').on(table.city),
    cityCodeIdx: index('idx_attractions_city_code').on(table.cityCode),
    nameIdx: index('idx_attractions_name').on(table.name),
    statusIdx: index('idx_attractions_status').on(table.status),
  }),
);

export type Attraction = typeof attractions.$inferSelect;
export type NewAttraction = typeof attractions.$inferInsert;
