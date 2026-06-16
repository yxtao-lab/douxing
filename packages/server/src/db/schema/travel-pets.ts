import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  json,
  index,
} from 'drizzle-orm/mysql-core';
import { users } from './users.js';

/** H3：用户旅行宠物 */
export const travelPets = mysqlTable(
  'travel_pets',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    species: varchar('species', { length: 32 }).notNull().default('fox'),
    nickname: varchar('nickname', { length: 64 }).notNull().default(''),
    personality: varchar('personality', { length: 32 }).notNull().default('guide'),
    level: int('level').notNull().default(1),
    exp: int('exp').notNull().default(0),
    mood: varchar('mood', { length: 16 }).notNull().default('happy'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdx: index('uk_travel_pets_user').on(table.userId),
  }),
);

export type TravelPet = typeof travelPets.$inferSelect;
export type NewTravelPet = typeof travelPets.$inferInsert;
