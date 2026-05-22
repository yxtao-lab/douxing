import { mysqlTable, int, varchar, text, timestamp, json } from 'drizzle-orm/mysql-core';

export type BadgeConditionValue = Record<string, unknown>;

/** 徽章定义表 */
export const badges = mysqlTable('badges', {
  id: int('id').primaryKey().autoincrement(),
  badgeCode: varchar('badge_code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 32 }).notNull().default('achievement'),
  conditionType: varchar('condition_type', { length: 50 }).notNull(),
  conditionValue: json('condition_value').$type<BadgeConditionValue>(),
  iconUrl: varchar('icon_url', { length: 500 }),
  rarity: varchar('rarity', { length: 32 }).notNull().default('common'),
  pointsReward: int('points_reward').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Badge = typeof badges.$inferSelect;
export type NewBadge = typeof badges.$inferInsert;
