import {
  mysqlTable,
  int,
  bigint,
  varchar,
  timestamp,
  json,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { travelRoutes } from './travel-routes.js';
import { checkIns } from './check-ins.js';
import { attractions } from './attractions.js';

/** U4：验证积分事件账本（可审计；幂等键防同点刷分） */
export const verificationPointEvents = mysqlTable(
  'verification_point_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 见 @douxing/shared VerificationPointEventType */
    eventType: varchar('event_type', { length: 64 }).notNull(),
    points: int('points').notNull(),
    balanceAfter: int('balance_after').notNull(),
    /** 幂等去重键，如 checkin:user:route:poi */
    dedupeKey: varchar('dedupe_key', { length: 191 }).notNull(),
    routeId: int('route_id').references(() => travelRoutes.id, { onDelete: 'set null' }),
    checkInId: int('check_in_id').references(() => checkIns.id, { onDelete: 'set null' }),
    attractionId: int('attraction_id').references(() => attractions.id, { onDelete: 'set null' }),
    meta: json('meta').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    dedupeUnique: uniqueIndex('uk_verification_point_events_dedupe').on(table.dedupeKey),
    userTimeIdx: index('idx_verification_point_events_user_time').on(
      table.userId,
      table.createdAt,
    ),
    routeIdx: index('idx_verification_point_events_route').on(table.routeId),
    typeIdx: index('idx_verification_point_events_type').on(table.eventType),
  }),
);

export type VerificationPointEvent = typeof verificationPointEvents.$inferSelect;
export type NewVerificationPointEvent = typeof verificationPointEvents.$inferInsert;
