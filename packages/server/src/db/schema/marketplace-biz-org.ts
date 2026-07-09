import {
  mysqlTable,
  int,
  varchar,
  timestamp,
  json,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import type { BizOrgSettlementConfig } from '@douxing/shared';
import { users } from './users.js';

/** 商户组织（旅行社、摄影工作室等） */
export const bizOrg = mysqlTable(
  'biz_org',
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 128 }).notNull(),
    orgType: varchar('org_type', { length: 32 }).notNull(),
    licenseNo: varchar('license_no', { length: 64 }),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    settlementConfig: json('settlement_config').$type<BizOrgSettlementConfig | null>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    statusTypeIdx: index('idx_biz_org_status_type').on(table.status, table.orgType),
  }),
);

/** 商户组织成员 */
export const orgMember = mysqlTable(
  'org_member',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: int('org_id')
      .notNull()
      .references(() => bizOrg.id, { onDelete: 'cascade' }),
    orgRole: varchar('org_role', { length: 16 }).notNull().default('staff'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    orgUserUnique: uniqueIndex('uk_org_member_org_user').on(table.orgId, table.userId),
    userIdx: index('idx_org_member_user').on(table.userId),
  }),
);

export type BizOrg = typeof bizOrg.$inferSelect;
export type NewBizOrg = typeof bizOrg.$inferInsert;
export type OrgMember = typeof orgMember.$inferSelect;
export type NewOrgMember = typeof orgMember.$inferInsert;
