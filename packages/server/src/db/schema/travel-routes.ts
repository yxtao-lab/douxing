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

/** 路线表 */
export const travelRoutes = mysqlTable('travel_routes', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  /** 预算范围，如 "3000-8000" */
  budgetRange: varchar('budget_range', { length: 64 }),
  days: int('days').notNull().default(1),
  interestTags: json('interest_tags').$type<string[]>(),
  /** P-TAG-01：路线场景标签（slug 列表），规划生成时由 LLM 抽取或用户标签化定制时写入 */
  sceneTags: json('scene_tags').$type<string[]>(),
  routeDetail: json('route_detail').$type<Record<string, unknown>>(),
  creatorId: int('creator_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  viewCount: int('view_count').notNull().default(0),
  likeCount: int('like_count').notNull().default(0),
  collectCount: int('collect_count').notNull().default(0),
  commentCount: int('comment_count').notNull().default(0),
  /** 是否公开到广场（1=所有人可见并可互动） */
  isPublic: tinyint('is_public').notNull().default(0),
  /**
   * U1：路线来源
   * crawl | ai_draft | ugc_original | ugc_fork
   */
  sourceKind: varchar('source_kind', { length: 32 }).notNull().default('ugc_original'),
  /**
   * U1：内容层级
   * inspiration（灵感稿）| travel_ready（可出行，U3 起升级）
   */
  contentTier: varchar('content_tier', { length: 32 }).notNull().default('inspiration'),
  /**
   * U1：核验状态（爬取源默认 pending，广场展示「待核验」）
   * pending | verified
   */
  verificationStatus: varchar('verification_status', { length: 32 }).notNull().default('pending'),
  /**
   * U1：基础审核钩子
   * pending | approved | rejected；广场仅展示 approved
   */
  moderationStatus: varchar('moderation_status', { length: 32 }).notNull().default('approved'),
  /** U1：fork 父路线（ugc_fork 时可选） */
  parentRouteId: int('parent_route_id'),
  /** U3：可信度缓存分（0～100+，与热度分独立） */
  trustScore: int('trust_score').notNull().default(0),
  /** U3：可信度拆解 JSON */
  trustBreakdown: json('trust_breakdown').$type<Record<string, unknown> | null>(),
  /** U3：运营加冕为可出行（爬取未核验仍不可升级） */
  trustCrowned: tinyint('trust_crowned').notNull().default(0),
  /** U5：运营强制降为灵感稿（重算时不可因分数回升） */
  trustDemoted: tinyint('trust_demoted').notNull().default(0),
  status: tinyint('status').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export type TravelRoute = typeof travelRoutes.$inferSelect;
export type NewTravelRoute = typeof travelRoutes.$inferInsert;
