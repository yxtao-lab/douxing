import {
  mysqlTable,
  int,
  varchar,
  text,
  tinyint,
  timestamp,
  json,
} from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { travelRoutes } from './travel-routes.js';

/** 规划会话状态：0=进行中，1=已结束 */
export const PlanSessionStatus = {
  ACTIVE: 0,
  CLOSED: 1,
} as const;

export type PlanRouteSnapshot = Record<string, unknown>;

/** AI 规划多轮对话会话 */
export const planSessions = mysqlTable('plan_sessions', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  routeId: int('route_id').references(() => travelRoutes.id, { onDelete: 'set null' }),
  provider: varchar('provider', { length: 16 }),
  status: tinyint('status').notNull().default(PlanSessionStatus.ACTIVE),
  title: varchar('title', { length: 128 }),
  intentSnapshot: json('intent_snapshot').$type<Record<string, unknown>>(),
  /** C7-b：Agent 编排状态 */
  agentState: json('agent_state').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

/** 规划会话消息 */
export const planSessionMessages = mysqlTable('plan_session_messages', {
  id: int('id').primaryKey().autoincrement(),
  sessionId: int('session_id')
    .notNull()
    .references(() => planSessions.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 16 }).notNull(),
  content: text('content').notNull(),
  routeSnapshot: json('route_snapshot').$type<PlanRouteSnapshot>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** C4：规划会话候选路线 */
export const planSessionCandidates = mysqlTable('plan_session_candidates', {
  id: int('id').primaryKey().autoincrement(),
  sessionId: int('session_id')
    .notNull()
    .references(() => planSessions.id, { onDelete: 'cascade' }),
  routeId: int('route_id')
    .notNull()
    .references(() => travelRoutes.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 64 }).notNull(),
  variantKey: varchar('variant_key', { length: 32 }),
  sortOrder: tinyint('sort_order').notNull().default(0),
  isSelected: tinyint('is_selected').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type PlanSession = typeof planSessions.$inferSelect;
export type PlanSessionMessage = typeof planSessionMessages.$inferSelect;
export type PlanSessionCandidate = typeof planSessionCandidates.$inferSelect;
