import {
  mysqlTable,
  int,
  varchar,
  timestamp,
  json,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { bizOrg } from './marketplace-biz-org.js';

/** 个人服务者（领队、摄影师等，可挂靠商户） */
export const serviceProvider = mysqlTable(
  'service_provider',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerType: varchar('provider_type', { length: 32 }).notNull(),
    orgId: int('org_id').references(() => bizOrg.id, { onDelete: 'set null' }),
    certStatus: varchar('cert_status', { length: 16 }).notNull().default('pending'),
    creditScore: int('credit_score').notNull().default(100),
    categoryCodes: json('category_codes').$type<string[]>().notNull(),
    serviceRegions: json('service_regions').$type<string[] | null>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    userUnique: uniqueIndex('uk_service_provider_user').on(table.userId),
    orgIdx: index('idx_service_provider_org').on(table.orgId),
    certIdx: index('idx_service_provider_cert').on(table.certStatus),
  }),
);

export type ServiceProvider = typeof serviceProvider.$inferSelect;
export type NewServiceProvider = typeof serviceProvider.$inferInsert;
