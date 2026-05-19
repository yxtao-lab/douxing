import { mysqlTable, int, varchar, text, timestamp } from 'drizzle-orm/mysql-core';
import { users } from './users.js';

/** 成就表 */
export const achievements = mysqlTable('achievements', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  achievementType: varchar('achievement_type', { length: 64 }).notNull(),
  unlockedAt: timestamp('unlocked_at').notNull().defaultNow(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;
