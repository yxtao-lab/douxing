import {
  mysqlTable,
  varchar,
  text,
  json,
  tinyint,
  int,
  timestamp,
} from 'drizzle-orm/mysql-core';
import type { WorkflowTemplateNodeConfig, WorkflowGraphDefinition, WorkflowGraphPublishStatus } from '@douxing/shared';

/** W3 · 规划工作流模板（JSON Logic 选择 + 节点参数） */
export const workflowTemplates = mysqlTable('workflow_templates', {
  id: varchar('id', { length: 64 }).primaryKey(),
  nameZh: varchar('name_zh', { length: 128 }).notNull(),
  nameEn: varchar('name_en', { length: 128 }).notNull(),
  descriptionZh: text('description_zh'),
  descriptionEn: text('description_en'),
  version: int('version').notNull().default(1),
  enabled: tinyint('enabled').notNull().default(1),
  priority: int('priority').notNull().default(0),
  selectionRules: json('selection_rules').$type<Record<string, unknown> | boolean>().notNull(),
  nodeConfig: json('node_config').$type<WorkflowTemplateNodeConfig>().notNull(),
  graphDef: json('graph_def').$type<WorkflowGraphDefinition | null>(),
  graphPublishStatus: varchar('graph_publish_status', { length: 16 })
    .$type<WorkflowGraphPublishStatus>()
    .notNull()
    .default('draft'),
  abVariantBId: varchar('ab_variant_b_id', { length: 64 }),
  abSplitPercent: int('ab_split_percent').notNull().default(0),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});
