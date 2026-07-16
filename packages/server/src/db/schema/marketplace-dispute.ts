import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { bizOrg } from './marketplace-biz-org.js';
import { serviceOrder } from './marketplace-order.js';

/** 服务订单履约争议（申诉与平台仲裁；M-TRUST-01） */
export const serviceOrderDispute = mysqlTable(
  'service_order_dispute',
  {
    id: int('id').primaryKey().autoincrement(),
    orderId: int('order_id')
      .notNull()
      .references(() => serviceOrder.id, { onDelete: 'cascade' }),
    /** 发起人用户 ID */
    initiatorUserId: int('initiator_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** 被申诉对象类型：user / org */
    respondentType: varchar('respondent_type', { length: 16 }).notNull(),
    /** 被申诉个人用户 ID */
    respondentUserId: int('respondent_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** 被申诉商户 ID */
    respondentOrgId: int('respondent_org_id').references(() => bizOrg.id, {
      onDelete: 'set null',
    }),
    /** 争议类型：quality / no_show / schedule / safety / other */
    type: varchar('type', { length: 32 }).notNull(),
    /** 争议原因描述 */
    reason: text('reason'),
    /** 争议状态：pending / platform_processing / resolved_buyer / resolved_seller / closed */
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    /** 平台仲裁备注 */
    platformNote: text('platform_note'),
    /** 结案时间 */
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    orderIdx: index('idx_service_order_dispute_order').on(table.orderId),
    initiatorIdx: index('idx_service_order_dispute_initiator').on(table.initiatorUserId),
    respondentUserIdx: index('idx_service_order_dispute_respondent_user').on(table.respondentUserId),
    respondentOrgIdx: index('idx_service_order_dispute_respondent_org').on(table.respondentOrgId),
    statusIdx: index('idx_service_order_dispute_status').on(table.status),
  }),
);

export type ServiceOrderDispute = typeof serviceOrderDispute.$inferSelect;
export type NewServiceOrderDispute = typeof serviceOrderDispute.$inferInsert;
