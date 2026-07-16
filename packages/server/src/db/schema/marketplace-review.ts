import {
  mysqlTable,
  int,
  varchar,
  text,
  json,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { bizOrg } from './marketplace-biz-org.js';
import { serviceOrder } from './marketplace-order.js';

/** 服务订单履约评价（双向评价；M-TRUST-01） */
export const serviceOrderReview = mysqlTable(
  'service_order_review',
  {
    id: int('id').primaryKey().autoincrement(),
    orderId: int('order_id')
      .notNull()
      .references(() => serviceOrder.id, { onDelete: 'cascade' }),
    /** 评价方类型：buyer / seller */
    targetType: varchar('target_type', { length: 16 }).notNull(),
    /** 评价人用户 ID */
    fromUserId: int('from_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** 被评价对象类型：user / org */
    toTargetType: varchar('to_target_type', { length: 16 }).notNull(),
    /** 被评价个人用户 ID；评价商户时为 null */
    toUserId: int('to_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** 被评价商户 ID；评价个人时为 null */
    toOrgId: int('to_org_id').references(() => bizOrg.id, { onDelete: 'set null' }),
    /** 星级 1～5 */
    rating: int('rating').notNull(),
    /** 评价正文 */
    content: text('content'),
    /** 预设标签数组 */
    tags: json('tags').$type<string[] | null>(),
    /** 商家回复正文 */
    replyContent: text('reply_content'),
    /** 商家回复时间 */
    replyAt: timestamp('reply_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    orderTargetUnique: uniqueIndex('uk_service_order_review_order_target').on(
      table.orderId,
      table.targetType,
    ),
    orderIdx: index('idx_service_order_review_order').on(table.orderId),
    fromUserIdx: index('idx_service_order_review_from_user').on(table.fromUserId),
    toUserIdx: index('idx_service_order_review_to_user').on(table.toUserId),
    toOrgIdx: index('idx_service_order_review_to_org').on(table.toOrgId),
  }),
);

export type ServiceOrderReview = typeof serviceOrderReview.$inferSelect;
export type NewServiceOrderReview = typeof serviceOrderReview.$inferInsert;
