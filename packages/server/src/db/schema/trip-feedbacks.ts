import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  json,
  decimal,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import type {
  TripFeedbackGoldenPayload,
  TripFeedbackPoiItem,
  TripFeedbackRatingSummary,
  TripFeedbackStatusValue,
} from '@douxing/shared';
import { users } from './users.js';
import { travelRoutes } from './travel-routes.js';

/** A-COGNITION-02：行程复盘（计划 vs 实际）与 Golden Case 回流载荷 */
export const tripFeedbacks = mysqlTable(
  'trip_feedbacks',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    routeId: int('route_id')
      .notNull()
      .references(() => travelRoutes.id, { onDelete: 'cascade' }),
    /** draft | finalized */
    status: varchar('status', { length: 32 })
      .$type<TripFeedbackStatusValue>()
      .notNull()
      .default('draft'),
    plannedCount: int('planned_count').notNull().default(0),
    visitedCount: int('visited_count').notNull().default(0),
    skippedCount: int('skipped_count').notNull().default(0),
    completionRate: decimal('completion_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    visitedJson: json('visited_json').$type<TripFeedbackPoiItem[]>().notNull(),
    skippedJson: json('skipped_json').$type<TripFeedbackPoiItem[]>().notNull(),
    ratingSummaryJson: json('rating_summary_json')
      .$type<TripFeedbackRatingSummary>()
      .notNull(),
    summaryText: text('summary_text').notNull(),
    /** 训练 / RAG 召回分桶载荷 */
    goldenPayloadJson: json('golden_payload_json').$type<TripFeedbackGoldenPayload | null>(),
    memoryIdsJson: json('memory_ids_json').$type<number[] | null>(),
    finalizedAt: timestamp('finalized_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    userRouteUnique: uniqueIndex('uk_trip_feedbacks_user_route').on(
      table.userId,
      table.routeId,
    ),
    userTimeIdx: index('idx_trip_feedbacks_user_time').on(
      table.userId,
      table.createdAt,
    ),
    statusIdx: index('idx_trip_feedbacks_status').on(table.status),
  }),
);

export type TripFeedbackRow = typeof tripFeedbacks.$inferSelect;
export type NewTripFeedbackRow = typeof tripFeedbacks.$inferInsert;
