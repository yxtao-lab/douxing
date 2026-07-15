import {
  mysqlTable,
  int,
  varchar,
  text,
  decimal,
  date,
  timestamp,
  json,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import type { DemandInvoiceInfo } from '@douxing/shared';
import { users } from './users.js';
import { travelRoutes } from './travel-routes.js';
import { bizOrg } from './marketplace-biz-org.js';

/** 团体发单主体（班级、公司、社区） */
export const demandGroup = mysqlTable(
  'demand_group',
  {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 128 }).notNull(),
    groupType: varchar('group_type', { length: 32 }).notNull().default('other'),
    headcount: int('headcount'),
    ownerUserId: int('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    ownerIdx: index('idx_demand_group_owner').on(table.ownerUserId),
  }),
);

/** 团体成员 */
export const groupMember = mysqlTable(
  'group_member',
  {
    id: int('id').primaryKey().autoincrement(),
    groupId: int('group_id')
      .notNull()
      .references(() => demandGroup.id, { onDelete: 'cascade' }),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memberRole: varchar('member_role', { length: 16 }).notNull().default('collaborator'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    groupUserUnique: uniqueIndex('uk_group_member_group_user').on(table.groupId, table.userId),
  }),
);

/** 服务需求单 / 发单 */
export const serviceDemand = mysqlTable(
  'service_demand',
  {
    id: int('id').primaryKey().autoincrement(),
    demandNo: varchar('demand_no', { length: 32 }).notNull(),
    publisherType: varchar('publisher_type', { length: 16 }).notNull().default('user'),
    publisherUserId: int('publisher_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    publisherGroupId: int('publisher_group_id').references(() => demandGroup.id, {
      onDelete: 'set null',
    }),
    categoryCode: varchar('category_code', { length: 64 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    destination: varchar('destination', { length: 128 }),
    startDate: date('start_date'),
    endDate: date('end_date'),
    budgetMin: decimal('budget_min', { precision: 12, scale: 2 }),
    budgetMax: decimal('budget_max', { precision: 12, scale: 2 }),
    budgetType: varchar('budget_type', { length: 16 }),
    /** 预计出行/服务人数（M3-3） */
    headcount: int('headcount'),
    /** 发票抬头 JSON（M3-3；本阶段仅存资料，不做真开票） */
    invoiceInfo: json('invoice_info').$type<DemandInvoiceInfo | null>(),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    routeId: int('route_id').references(() => travelRoutes.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    demandNoUnique: uniqueIndex('uk_service_demand_no').on(table.demandNo),
    statusPublisherIdx: index('idx_service_demand_status_publisher').on(
      table.status,
      table.publisherUserId,
    ),
    categoryIdx: index('idx_service_demand_category').on(table.categoryCode),
  }),
);

/** 服务方报价 */
export const demandQuote = mysqlTable(
  'demand_quote',
  {
    id: int('id').primaryKey().autoincrement(),
    demandId: int('demand_id')
      .notNull()
      .references(() => serviceDemand.id, { onDelete: 'cascade' }),
    orgId: int('org_id').references(() => bizOrg.id, { onDelete: 'set null' }),
    providerUserId: int('provider_user_id').references(() => users.id, { onDelete: 'set null' }),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    proposalText: text('proposal_text'),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    demandIdx: index('idx_demand_quote_demand').on(table.demandId),
  }),
);

export type DemandGroup = typeof demandGroup.$inferSelect;
export type ServiceDemand = typeof serviceDemand.$inferSelect;
export type DemandQuote = typeof demandQuote.$inferSelect;
