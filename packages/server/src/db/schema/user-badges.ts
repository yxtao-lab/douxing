import { mysqlTable, int, timestamp, json, boolean, index, uniqueIndex } from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { badges } from './badges.js';

export type UserBadgeProgress = Record<string, unknown>;

/** 用户已解锁徽章 */
export const userBadges = mysqlTable(
  'user_badges',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    badgeId: int('badge_id')
      .notNull()
      .references(() => badges.id, { onDelete: 'cascade' }),
    unlockTime: timestamp('unlock_time').notNull().defaultNow(),
    progress: json('progress').$type<UserBadgeProgress>(),
    isDisplayed: boolean('is_displayed').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_user_badges_user').on(table.userId),
    userBadgeUk: uniqueIndex('uk_user_badge').on(table.userId, table.badgeId),
  }),
);

export type UserBadge = typeof userBadges.$inferSelect;
export type NewUserBadge = typeof userBadges.$inferInsert;
