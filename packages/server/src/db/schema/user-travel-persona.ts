import {
  mysqlTable,
  int,
  varchar,
  text,
  json,
  timestamp,
} from 'drizzle-orm/mysql-core';
import { users } from './users.js';

/**
 * 统一用户旅行画像（A-COGNITION-01）
 *
 * 聚合兴趣标签、宠物记忆、历史路线、打卡、相册等数据源，
 * 生成可解释的旅行人格快照，供 AI 规划注入与 UI 展示。
 */
export const userTravelPersona = mysqlTable('user_travel_persona', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** 画像版本号，每次刷新递增 */
  personaVersion: int('persona_version').notNull().default(1),
  /** 旅行风格标签，如「文化探索型」「亲子休闲型」 */
  travelStyle: varchar('travel_style', { length: 64 }),
  /** 旅行节奏：relaxed / balanced / intensive */
  rhythm: varchar('rhythm', { length: 32 }).notNull().default('balanced'),
  /** 预算档次：budget / mid-range / premium */
  budgetTier: varchar('budget_tier', { length: 32 }).notNull().default('mid-range'),
  /** 预算弹性：fixed / flexible */
  budgetFlexibility: varchar('budget_flexibility', { length: 32 }).notNull().default('flexible'),
  /** 同伴结构标签数组：solo / couple / family / group */
  companionStructure: json('companion_structure').$type<string[]>(),
  /** 偏好目的地 Top 列表（城市名） */
  topDestinations: json('top_destinations').$type<string[]>(),
  /** 偏好景点类型 Top 列表 */
  topPoiTypes: json('top_poi_types').$type<string[]>(),
  /** 兴趣标签（来自用户资料） */
  interestTags: json('interest_tags').$type<string[]>(),
  /** 记忆主题（来自宠物记忆 preference 类型） */
  memoryThemes: json('memory_themes').$type<string[]>(),
  /** 忌讳/避开列表（来自 regret 记忆 + 去过 POI） */
  avoidList: json('avoid_list').$type<string[]>(),
  /** 拍照热情：low / medium / high */
  photoEnthusiasm: varchar('photo_enthusiasm', { length: 32 }).notNull().default('medium'),
  /** 历史路线数量 */
  routeCount: int('route_count').notNull().default(0),
  /** 打卡总数 */
  checkinCount: int('checkin_count').notNull().default(0),
  /** 相册照片总数 */
  photoCount: int('photo_count').notNull().default(0),
  /** 人类可读画像摘要，供 LLM 规划注入 */
  summary: text('summary'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export type UserTravelPersona = typeof userTravelPersona.$inferSelect;
export type NewUserTravelPersona = typeof userTravelPersona.$inferInsert;
