import { mysqlTable, int, varchar, tinyint, timestamp, json } from 'drizzle-orm/mysql-core';

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
  /** 用户兴趣偏好标签 */
  interestTags: json('interest_tags').$type<string[]>(),
  /** P-TAG-01：用户偏好场景标签（slug 列表），用于首页/专题/规划个性化推荐 */
  preferredScenes: json('preferred_scenes').$type<string[]>(),
  /** P-ONBOARD-01：性别（自愿） */
  gender: varchar('gender', { length: 16 }),
  /** P-ONBOARD-01：年龄段（不收集精确年龄） */
  ageRange: varchar('age_range', { length: 16 }),
  /** P-ONBOARD-01：旅行半径 */
  travelRadius: varchar('travel_radius', { length: 16 }),
  /** P-ONBOARD-01：同伴结构 slug 列表 */
  companionStructure: json('companion_structure').$type<string[]>(),
  /** P-ONBOARD-01：预算档次 */
  budgetTier: varchar('budget_tier', { length: 32 }),
  /** P-ONBOARD-01：首次标签引导完成时间；null 表示未引导 */
  onboardedAt: timestamp('onboarded_at'),
  /** 会员等级，见 @douxing/shared MemberLevel */
  memberLevel: tinyint('member_level').notNull().default(0),
  /** 付费会员到期时间（免费会员为 null） */
  memberExpiresAt: timestamp('member_expires_at'),
  status: tinyint('status').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
