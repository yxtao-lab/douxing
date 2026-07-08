/**
 * W5 · 可视化工作流编排：DAG 图定义、节点目录与静态校验。
 */

/** 图 JSON schema 版本 */
export const WORKFLOW_GRAPH_SCHEMA_VERSION = 1 as const;

/** 编辑器节点种类 */
export type WorkflowGraphNodeKind =
  | 'start'
  | 'end'
  | 'tool'
  | 'condition'
  | 'subgraph'
  | 'branch';

/** 发布状态（W5-5） */
export type WorkflowGraphPublishStatus = 'draft' | 'published';

/** 规划 Agent 可调用的 Tool 名（与 server AGENT_TOOL_NAMES 保持一致） */
export const WORKFLOW_EDITOR_TOOL_NAMES = [
  'parse_intent',
  'select_workflow_template',
  'retrieve_attractions',
  'retrieve_playbooks',
  'generate_route_draft',
  'enrich_route',
  'validate_route',
  'build_route_variants',
  'patch_route_day',
  'tune_route_budget',
  'answer_food_qa',
  'select_plan_variant',
  'recall_user_memory',
  'apply_memory_context',
  'write_trip_memory',
  'replan_segment',
  'detect_missed_pois',
] as const;

export type WorkflowEditorToolName = (typeof WORKFLOW_EDITOR_TOOL_NAMES)[number];

/** 编排层虚拟节点（非 HTTP Tool，对应 LangGraph 子图/分支） */
export const WORKFLOW_ORCHESTRATION_NODE_DEFS = [
  { id: 'memory_subgraph', kind: 'subgraph' as const, labelKey: 'workflowEditor.node.memorySubgraph' },
  { id: 'transit_subgraph', kind: 'subgraph' as const, labelKey: 'workflowEditor.node.transitSubgraph' },
  { id: 'intent_router', kind: 'condition' as const, labelKey: 'workflowEditor.node.intentRouter' },
  { id: 'tweak_branch', kind: 'branch' as const, labelKey: 'workflowEditor.node.tweakBranch' },
  { id: 'budget_branch', kind: 'branch' as const, labelKey: 'workflowEditor.node.budgetBranch' },
  { id: 'lodging_branch', kind: 'branch' as const, labelKey: 'workflowEditor.node.lodgingBranch' },
  { id: 'qa_food_branch', kind: 'branch' as const, labelKey: 'workflowEditor.node.qaFoodBranch' },
  { id: 'select_variant_branch', kind: 'branch' as const, labelKey: 'workflowEditor.node.selectVariantBranch' },
  { id: 'plan_new_branch', kind: 'branch' as const, labelKey: 'workflowEditor.node.planNewBranch' },
] as const;

/** 画布节点坐标 */
export interface WorkflowGraphPosition {
  x: number;
  y: number;
}

/** 节点级 data：子图引用、Tool 入参覆盖等 */
export interface WorkflowGraphNodeDataConfig {
  /** kind=subgraph 时引用 memory / transit 等 */
  subgraphRef?: string;
  /** kind=tool 时静态入参覆盖（编译/runtime 合并进 payload） */
  overrides?: Record<string, unknown>;
}

/** DAG 节点 */
export interface WorkflowGraphNode {
  id: string;
  kind: WorkflowGraphNodeKind;
  /** i18n 标签键；Tool 节点可省略（用 agent.status.{toolName}） */
  labelKey?: string;
  /** kind=tool 时必填 */
  toolName?: WorkflowEditorToolName | string;
  position: WorkflowGraphPosition;
  /** 节点级参数（子图引用、Tool overrides） */
  data?: WorkflowGraphNodeDataConfig & Record<string, unknown>;
}

/** DAG 边 */
export interface WorkflowGraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  /** 条件边标签，如 tweak_day */
  label?: string;
}

/** 工作流图定义（持久化至 workflow_templates.graph_def） */
export interface WorkflowGraphDefinition {
  schemaVersion: typeof WORKFLOW_GRAPH_SCHEMA_VERSION;
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
}

/** 图校验问题码 */
export type WorkflowGraphValidationCode =
  | 'EMPTY_GRAPH'
  | 'MISSING_START'
  | 'MISSING_END'
  | 'DUPLICATE_NODE_ID'
  | 'DANGLING_EDGE'
  | 'UNREACHABLE_NODE'
  | 'CYCLE_DETECTED'
  | 'INVALID_TOOL'
  | 'CONDITION_TOO_FEW_EDGES'
  | 'DISCONNECTED_END';

/** 单条校验问题（messageKey 供 Web i18n 使用） */
export interface WorkflowGraphValidationIssue {
  code: WorkflowGraphValidationCode;
  messageKey: string;
  nodeId?: string;
  edgeId?: string;
}

/** 图校验结果 */
export interface WorkflowGraphValidationResult {
  valid: boolean;
  issues: WorkflowGraphValidationIssue[];
}

/**
 * 判断 Tool 名是否在编辑器白名单内。
 *
 * @param toolName - 节点上配置的 Tool 名
 * @returns 是否为已知 Agent Tool
 */
export function isKnownWorkflowEditorTool(toolName: string): toolName is WorkflowEditorToolName {
  return (WORKFLOW_EDITOR_TOOL_NAMES as readonly string[]).includes(toolName);
}

/**
 * 构建与 `plan_default.py` 主图等价的默认 DAG（可视化参考模板）。
 *
 * @returns 带坐标的默认图定义
 */
export function buildDefaultPlanDefaultGraph(): WorkflowGraphDefinition {
  const col = (index: number, xStart = 80, yStart = 80, xGap = 220, yGap = 100) => ({
    x: xStart + (index % 4) * xGap,
    y: yStart + Math.floor(index / 4) * yGap,
  });

  const nodes: WorkflowGraphNode[] = [
    { id: 'start', kind: 'start', labelKey: 'workflowEditor.node.start', position: col(0) },
    {
      id: 'memory',
      kind: 'subgraph',
      labelKey: 'workflowEditor.node.memorySubgraph',
      position: col(1),
      data: { subgraphRef: 'memory' },
    },
    {
      id: 'parse_intent',
      kind: 'tool',
      toolName: 'parse_intent',
      position: col(2),
    },
    {
      id: 'apply_memory',
      kind: 'tool',
      toolName: 'apply_memory_context',
      position: col(3),
    },
    {
      id: 'intent_router',
      kind: 'condition',
      labelKey: 'workflowEditor.node.intentRouter',
      position: { x: 920, y: 180 },
    },
    {
      id: 'tweak_branch',
      kind: 'branch',
      labelKey: 'workflowEditor.node.tweakBranch',
      position: { x: 1180, y: 40 },
    },
    {
      id: 'budget_branch',
      kind: 'branch',
      labelKey: 'workflowEditor.node.budgetBranch',
      position: { x: 1180, y: 120 },
    },
    {
      id: 'lodging_branch',
      kind: 'branch',
      labelKey: 'workflowEditor.node.lodgingBranch',
      position: { x: 1180, y: 200 },
    },
    {
      id: 'qa_food_branch',
      kind: 'branch',
      labelKey: 'workflowEditor.node.qaFoodBranch',
      position: { x: 1180, y: 280 },
    },
    {
      id: 'select_variant_branch',
      kind: 'branch',
      labelKey: 'workflowEditor.node.selectVariantBranch',
      position: { x: 1180, y: 360 },
    },
    {
      id: 'plan_new_branch',
      kind: 'branch',
      labelKey: 'workflowEditor.node.planNewBranch',
      position: { x: 1180, y: 440 },
    },
    { id: 'end', kind: 'end', labelKey: 'workflowEditor.node.end', position: { x: 1480, y: 240 } },
  ];

  const edges: WorkflowGraphEdge[] = [
    { id: 'e-start-memory', source: 'start', target: 'memory' },
    { id: 'e-memory-parse', source: 'memory', target: 'parse_intent' },
    { id: 'e-parse-apply', source: 'parse_intent', target: 'apply_memory' },
    { id: 'e-apply-router', source: 'apply_memory', target: 'intent_router' },
    { id: 'e-router-tweak', source: 'intent_router', target: 'tweak_branch', label: 'tweak_day|tweak_poi' },
    { id: 'e-router-budget', source: 'intent_router', target: 'budget_branch', label: 'budget_tune' },
    { id: 'e-router-lodging', source: 'intent_router', target: 'lodging_branch', label: 'lodging_tune' },
    { id: 'e-router-qa', source: 'intent_router', target: 'qa_food_branch', label: 'qa_food' },
    { id: 'e-router-select', source: 'intent_router', target: 'select_variant_branch', label: 'select_variant' },
    { id: 'e-router-plan', source: 'intent_router', target: 'plan_new_branch', label: 'default' },
    { id: 'e-tweak-end', source: 'tweak_branch', target: 'end' },
    { id: 'e-budget-end', source: 'budget_branch', target: 'end' },
    { id: 'e-lodging-end', source: 'lodging_branch', target: 'end' },
    { id: 'e-qa-end', source: 'qa_food_branch', target: 'end' },
    { id: 'e-select-end', source: 'select_variant_branch', target: 'end' },
    { id: 'e-plan-end', source: 'plan_new_branch', target: 'end' },
  ];

  return { schemaVersion: WORKFLOW_GRAPH_SCHEMA_VERSION, nodes, edges };
}

/**
 * 对 DAG 图做发布前静态校验（无环、必填边、Tool 合法性等）。
 *
 * @param graph - 待校验图定义；null/undefined 视为空图
 * @returns 校验结果与问题列表
 */
export function validateWorkflowGraph(
  graph: WorkflowGraphDefinition | null | undefined,
): WorkflowGraphValidationResult {
  const issues: WorkflowGraphValidationIssue[] = [];

  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    issues.push({
      code: 'EMPTY_GRAPH',
      messageKey: 'workflowEditor.validation.emptyGraph',
    });
    return { valid: false, issues };
  }

  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({
        code: 'DUPLICATE_NODE_ID',
        messageKey: 'workflowEditor.validation.duplicateNodeId',
        nodeId: node.id,
      });
    }
    nodeIds.add(node.id);

    if (node.kind === 'tool') {
      const tool = node.toolName?.trim();
      if (!tool || !isKnownWorkflowEditorTool(tool)) {
        issues.push({
          code: 'INVALID_TOOL',
          messageKey: 'workflowEditor.validation.invalidTool',
          nodeId: node.id,
        });
      }
    }
  }

  const startNodes = graph.nodes.filter((n) => n.kind === 'start');
  const endNodes = graph.nodes.filter((n) => n.kind === 'end');
  if (startNodes.length === 0) {
    issues.push({ code: 'MISSING_START', messageKey: 'workflowEditor.validation.missingStart' });
  }
  if (endNodes.length === 0) {
    issues.push({ code: 'MISSING_END', messageKey: 'workflowEditor.validation.missingEnd' });
  }

  for (const edge of graph.edges ?? []) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({
        code: 'DANGLING_EDGE',
        messageKey: 'workflowEditor.validation.danglingEdge',
        edgeId: edge.id,
      });
    }
  }

  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    outDegree.set(id, 0);
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of graph.edges ?? []) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    adjacency.get(edge.source)!.push(edge.target);
  }

  for (const node of graph.nodes) {
    if (node.kind === 'start') continue;
    if ((inDegree.get(node.id) ?? 0) === 0) {
      issues.push({
        code: 'UNREACHABLE_NODE',
        messageKey: 'workflowEditor.validation.unreachableNode',
        nodeId: node.id,
      });
    }
  }

  for (const node of graph.nodes) {
    if (node.kind === 'end') continue;
    if ((outDegree.get(node.id) ?? 0) === 0) {
      issues.push({
        code: 'DISCONNECTED_END',
        messageKey: 'workflowEditor.validation.disconnectedNode',
        nodeId: node.id,
      });
    }
  }

  for (const node of graph.nodes) {
    if (node.kind !== 'condition') continue;
    if ((outDegree.get(node.id) ?? 0) < 2) {
      issues.push({
        code: 'CONDITION_TOO_FEW_EDGES',
        messageKey: 'workflowEditor.validation.conditionTooFewEdges',
        nodeId: node.id,
      });
    }
  }

  const cycleNode = detectCycleNode(Array.from(nodeIds), adjacency);
  if (cycleNode) {
    issues.push({
      code: 'CYCLE_DETECTED',
      messageKey: 'workflowEditor.validation.cycleDetected',
      nodeId: cycleNode,
    });
  }

  return { valid: issues.length === 0, issues };
}

/**
 * DFS 检测有向图中是否存在环。
 *
 * @param nodeIds - 全部节点 ID
 * @param adjacency - 邻接表
 * @returns 环上某一节点 ID；无环时 null
 */
function detectCycleNode(nodeIds: string[], adjacency: Map<string, string[]>): string | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const dfs = (id: string): string | null => {
    if (visiting.has(id)) return id;
    if (visited.has(id)) return null;
    visiting.add(id);
    for (const next of adjacency.get(id) ?? []) {
      const found = dfs(next);
      if (found) return found;
    }
    visiting.delete(id);
    visited.add(id);
    return null;
  };

  for (const id of nodeIds) {
    const found = dfs(id);
    if (found) return found;
  }
  return null;
}
