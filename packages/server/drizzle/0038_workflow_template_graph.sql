-- W5 · 工作流模板可视化 DAG 定义与发布状态
ALTER TABLE `workflow_templates`
  ADD COLUMN `graph_def` JSON NULL COMMENT 'W5 可视化 DAG JSON' AFTER `node_config`,
  ADD COLUMN `graph_publish_status` VARCHAR(16) NOT NULL DEFAULT 'draft' COMMENT 'draft|published' AFTER `graph_def`;
