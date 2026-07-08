/**
 * W3 · 工作流模板：按 intent 选择 DAG 参数（RAG topK、方案数等）。
 */

import type { WorkflowGraphDefinition, WorkflowGraphPublishStatus } from './workflow-graph.js';

/** 模板节点级可调参数（plan_new 主链） */
export interface WorkflowTemplateNodeConfig {
  /** RAG 检索上限；未设时由 days×6 推算 */
  topK?: number;
  /** 首句规划候选方案数；未设时走会员等级默认 */
  variantCount?: number;
  /** MMR 多样性系数 0～1；未设时读 env */
  mmrLambda?: number;
  /** 玩法动线检索上限；默认 3 */
  playbookLimit?: number;
  /** 为 true 时跳过 build_route_variants，仅生成单方案 */
  skipVariants?: boolean;
}

/** 管理端 / API 工作流模板详情 */
export interface WorkflowTemplateInfo {
  id: string;
  nameZh: string;
  nameEn: string;
  descriptionZh?: string | null;
  descriptionEn?: string | null;
  version: number;
  enabled: boolean;
  /** 选择器按 priority 降序匹配，首条命中生效 */
  priority: number;
  /** JSON Logic 规则；`true` 表示恒匹配（作兜底） */
  selectionRules: Record<string, unknown> | boolean;
  nodeConfig: WorkflowTemplateNodeConfig;
  /** A/B 对照模板 ID；与 abSplitPercent 联用 */
  abVariantBId?: string | null;
  /** 0 表示关闭 A/B；1～99 表示 B 桶流量占比 */
  abSplitPercent: number;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  /** W5 · 可视化 DAG 定义；null 表示沿用运行时默认硬编码图 */
  graphDef?: WorkflowGraphDefinition | null;
  /** W5 · 图定义发布状态 */
  graphPublishStatus?: WorkflowGraphPublishStatus;
}

/** 模板选择器输出（写入 agent_state / NodeSpan） */
export interface WorkflowTemplateSelectionResult {
  templateId: string;
  templateVersion: number;
  nodeConfig: WorkflowTemplateNodeConfig;
  /** 已发布 DAG；未发布或无图时为 null/undefined */
  graphDef?: WorkflowGraphDefinition | null;
  /** 图发布状态 */
  graphPublishStatus?: WorkflowGraphPublishStatus;
  /** A/B 分桶；未开启时为 undefined */
  abBucket?: 'A' | 'B';
  /** 命中模板的 priority，便于诊断 */
  matchedPriority?: number;
}

/**
 * 合并模板 nodeConfig 与运行时默认值。
 *
 * @param config - 模板节点配置；空对象时返回 defaults 拷贝
 * @param defaults - 缺省 topK / variantCount 等
 * @returns 合并后的有效配置
 */
export function mergeWorkflowTemplateNodeConfig(
  config: WorkflowTemplateNodeConfig | undefined | null,
  defaults?: WorkflowTemplateNodeConfig,
): WorkflowTemplateNodeConfig {
  return {
    ...(defaults ?? {}),
    ...(config ?? {}),
  };
}
