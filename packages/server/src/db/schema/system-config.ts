import { mysqlTable, int, varchar, text, timestamp } from 'drizzle-orm/mysql-core';

export const systemConfig = mysqlTable('system_config', {
  id: int('id').primaryKey().autoincrement(),
  configKey: varchar('config_key', { length: 64 }).notNull().unique(),
  configValue: text('config_value').notNull(),
  remark: varchar('remark', { length: 255 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});
