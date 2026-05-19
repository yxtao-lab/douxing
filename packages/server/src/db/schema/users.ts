import { mysqlTable, int, varchar, tinyint, timestamp } from 'drizzle-orm/mysql-core';

/** 用户表：认证信息、联系方式、用户类型 */
export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  username: varchar('username', { length: 64 }).notNull().unique(),
  /** bcrypt 密码哈希 */
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 128 }),
  /** 业务用户类型，见 @douxing/shared UserType */
  userType: tinyint('user_type').notNull().default(1),
  nickname: varchar('nickname', { length: 64 }).notNull().default(''),
  avatar: varchar('avatar', { length: 512 }),
  status: tinyint('status').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
