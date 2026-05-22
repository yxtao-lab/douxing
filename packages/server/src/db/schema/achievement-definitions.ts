import { mysqlTable, int, varchar, text, timestamp, json } from 'drizzle-orm/mysql-core';

export type AchievementConditionValue = Record<string, unknown>;

/** 成就配置表 */
export const achievementDefinitions = mysqlTable('achievement_definitions', {
  id: int('id').primaryKey().autoincrement(),
  achievementCode: varchar('achievement_code', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 32 }).notNull().default('explore'),
  conditionType: varchar('condition_type', { length: 50 }).notNull(),
  conditionValue: json('condition_value').$type<AchievementConditionValue>(),
  iconUrl: varchar('icon_url', { length: 500 }),
  pointsReward: int('points_reward').notNull().default(0),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type AchievementDefinition = typeof achievementDefinitions.$inferSelect;
export type NewAchievementDefinition = typeof achievementDefinitions.$inferInsert;
