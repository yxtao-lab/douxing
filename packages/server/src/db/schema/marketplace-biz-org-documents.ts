import {
  mysqlTable,
  int,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/mysql-core';
import { bizOrg } from './marketplace-biz-org.js';

/** 商户资质附件（营业执照、作品集等） */
export const bizOrgDocument = mysqlTable(
  'biz_org_documents',
  {
    id: int('id').primaryKey().autoincrement(),
    orgId: int('org_id')
      .notNull()
      .references(() => bizOrg.id, { onDelete: 'cascade' }),
    docType: varchar('doc_type', { length: 32 }).notNull(),
    fileUrl: varchar('file_url', { length: 512 }).notNull(),
    fileName: varchar('file_name', { length: 256 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    orgTypeIdx: index('idx_biz_org_documents_org_type').on(table.orgId, table.docType),
  }),
);

export type BizOrgDocument = typeof bizOrgDocument.$inferSelect;
export type NewBizOrgDocument = typeof bizOrgDocument.$inferInsert;
