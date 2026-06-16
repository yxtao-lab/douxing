import {
  mysqlTable,
  int,
  varchar,
  text,
  tinyint,
  timestamp,
  json,
  index,
} from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { travelPets } from './travel-pets.js';

/** H3：宠物结构化长期记忆 */
export const petMemories = mysqlTable(
  'pet_memories',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    petId: int('pet_id').references(() => travelPets.id, { onDelete: 'set null' }),
    /** preference | regret | visited | trip_summary | milestone */
    memoryType: varchar('memory_type', { length: 32 }).notNull(),
    content: text('content').notNull(),
    metadata: json('metadata').$type<Record<string, unknown>>(),
    importance: tinyint('importance').notNull().default(5),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdx: index('idx_pet_memories_user').on(table.userId),
    typeIdx: index('idx_pet_memories_type').on(table.memoryType),
  }),
);

export type PetMemory = typeof petMemories.$inferSelect;
export type NewPetMemory = typeof petMemories.$inferInsert;
