import { mysqlTable, int, varchar, timestamp } from 'drizzle-orm/mysql-core';
import { users } from './users.js';

/** Refresh Token 持久化表：仅存 SHA-256 哈希，支持轮换与吊销 */
export const refreshTokens = mysqlTable('refresh_tokens', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** refresh token 明文经 SHA-256 后的十六进制摘要 */
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  /** 非空表示已吊销（轮换或登出） */
  revokedAt: timestamp('revoked_at'),
  userAgent: varchar('user_agent', { length: 512 }),
  ip: varchar('ip', { length: 64 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
