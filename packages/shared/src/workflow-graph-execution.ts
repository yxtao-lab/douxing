import type { WorkflowGraphDefinition } from './workflow-graph.js';
import type { AgentToolTraceEntry } from './workflow-node-span.js';
import type { PlanSessionStreamToolCallPayload } from './types.js';

/** 画布节点执行状态（沙箱预览 / SSE 驱动） */
export type WorkflowNodeExecutionStatus = 'pending' | 'running' | 'success' | 'failed';

/** 单个画布节点的执行快照 */
export interface WorkflowNodeExecutionState {
  status: WorkflowNodeExecutionStatus;
  /** 关联的 NodeSpan；无匹配 span 时为空 */
  span?: AgentToolTraceEntry;
  /** 耗时毫秒 */
  ms?: number;
}

/** 整图执行快照 */
export interface WorkflowGraphExecutionSnapshot {
  /** 按 graph 节点 id 索引的执行状态 */
  nodeStates: Record<string, WorkflowNodeExecutionState>;
  /** 应高亮的边 id 列表（两端节点均已执行或正在执行） */
  activeEdgeIds: string[];
  /** 正在传递 state 的边（源节点已完成、目标运行中） */
  flowingEdgeIds: string[];
  /** 边 id → 上游 outputDigest 摘要（state 传递可视化） */
  edgeTransfers: Record<string, string>;
  /** 边 id → 完整 JSON 载荷（可展开） */
  edgeTransferPayloads: Record<string, string>;
  /** 本次规划路由意图（分支条件可视化） */
  routedIntent?: string;
  /** 命中的分支节点 id */
  takenBranchNodeId?: string | null;
  /** 条件路由命中的出边 */
  takenBranchEdgeIds: string[];
  /** 条件路由未命中的出边 */
  skippedBranchEdgeIds: string[];
  /** 当前正在运行的 tool 名（SSE 用） */
  runningTool?: string;
  /** 整次运行是否已结束 */
  completed: boolean;
  /** 运行失败 */
  failed: boolean;
}

/** Tool 名别名：trace 中 tool 与 graph toolName 不完全一致时的映射 */
const TOOL_NAME_ALIASES: Record<string, string> = {
  memory_agent: 'recall_user_memory',
};

/** routed_intent → plan_default 分支节点 id */
const ROUTED_INTENT_BRANCH_NODE: Record<string, string> = {
  tweak_day: 'tweak_branch',
  tweak_poi: 'tweak_branch',
  budget_tune: 'budget_branch',
  lodging_tune: 'lodging_branch',
  qa_food: 'qa_food_branch',
  select_variant: 'select_variant_branch',
  plan_new: 'plan_new_branch',
  unknown: 'plan_new_branch',
};

const EDGE_TRANSFER_PREVIEW_MAX = 48;

/**
 * 将 transfer 字符串格式化为可读 JSON；非 JSON 时原样返回。
 *
 * @param raw - outputDigest 或 JSON 字符串
 * @returns 格式化后的文本
 */
export function formatWorkflowTransferJson(raw: string | undefined): string {
  if (!raw?.trim()) return '';
  const text = raw.trim();
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/**
 * 生成边上展示的短摘要。
 *
 * @param raw - 完整 transfer 文本
 * @returns 截断摘要
 */
export function previewWorkflowTransferText(raw: string | undefined): string {
  if (!raw?.trim()) return '';
  const compact = raw.trim().replace(/\s+/g, ' ');
  if (compact.length <= EDGE_TRANSFER_PREVIEW_MAX) return compact;
  return `${compact.slice(0, EDGE_TRANSFER_PREVIEW_MAX)}…`;
}

/**
 * 从 NodeSpan digest 尝试解析 routed intent。
 *
 * @param digest - input/output digest
 * @returns 路由意图；无法解析时为 undefined
 */
export function tryExtractRoutedIntentFromDigest(digest: string | undefined): string | undefined {
  if (!digest?.trim()) return undefined;
  try {
    const parsed = JSON.parse(digest.trim()) as Record<string, unknown>;
    if (typeof parsed.routedIntent === 'string') return parsed.routedIntent;
    if (typeof parsed.route === 'string') return parsed.route;
  } catch {
    /* 非 JSON digest */
  }
  return undefined;
}

/**
 * 由 routed_intent 解析命中的分支节点 id。
 *
 * @param routedIntent - 路由意图
 * @returns 分支节点 id
 */
export function resolveBranchNodeIdFromRoutedIntent(routedIntent: string): string {
  return ROUTED_INTENT_BRANCH_NODE[routedIntent] ?? 'plan_new_branch';
}

/**
 * 将 trace 中的 tool 名规范化为 graph toolName。
 *
 * @param tool - trace 或 SSE 中的 tool 字段
 * @returns 用于匹配 graph 节点的 toolName
 */
export function normalizeExecutionToolName(tool: string): string {
  return TOOL_NAME_ALIASES[tool] ?? tool;
}

/**
 * 对 DAG 节点做拓扑排序（Kahn 算法）；无法排序时按原数组顺序返回。
 *
 * @param graph - 工作流图定义
 * @returns 节点 id 拓扑序
 */
export function sortWorkflowGraphNodeIdsTopologically(graph: WorkflowGraphDefinition): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of graph.edges) {
    if (!inDegree.has(edge.source) || !inDegree.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue = graph.nodes
    .map((node) => node.id)
    .filter((id) => (inDegree.get(id) ?? 0) === 0);
  const ordered: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);
    for (const next of adjacency.get(current) ?? []) {
      const nextDegree = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, nextDegree);
      if (nextDegree === 0) queue.push(next);
    }
  }

  if (ordered.length !== graph.nodes.length) {
    return graph.nodes.map((node) => node.id);
  }
  return ordered;
}

/**
 * 收集某节点在 DAG 中的所有后代节点 id（含间接）。
 *
 * @param graph - 工作流图定义
 * @param nodeId - 起始节点 id
 * @returns 后代节点 id 集合
 */
function collectDescendantNodeIds(graph: WorkflowGraphDefinition, nodeId: string): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  const visited = new Set<string>();
  const stack = [...(adjacency.get(nodeId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    stack.push(...(adjacency.get(current) ?? []));
  }
  return visited;
}

/**
 * 按 toolName 将 trace span 映射到 graph 上的 Tool 节点（同 tool 多次按拓扑序消费）。
 *
 * @param graph - 工作流图定义
 * @param spans - 已完成的 NodeSpan 列表
 * @returns 节点 id → 执行状态
 */
export function mapToolTraceSpansToGraphNodes(
  graph: WorkflowGraphDefinition,
  spans: AgentToolTraceEntry[],
): Record<string, WorkflowNodeExecutionState> {
  const states: Record<string, WorkflowNodeExecutionState> = {};
  for (const node of graph.nodes) {
    states[node.id] = { status: 'pending' };
  }

  const topoOrder = sortWorkflowGraphNodeIdsTopologically(graph);
  const toolNodeQueues = new Map<string, string[]>();

  for (const nodeId of topoOrder) {
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!node || node.kind !== 'tool' || !node.toolName) continue;
    const list = toolNodeQueues.get(node.toolName) ?? [];
    list.push(nodeId);
    toolNodeQueues.set(node.toolName, list);
  }

  const consumedByTool = new Map<string, number>();

  for (const span of spans) {
    const toolName = normalizeExecutionToolName(span.tool);
    const queue = toolNodeQueues.get(toolName);
    if (!queue?.length) continue;

    const index = consumedByTool.get(toolName) ?? 0;
    const nodeId = queue[index];
    if (!nodeId) continue;
    consumedByTool.set(toolName, index + 1);

    states[nodeId] = {
      status: span.ok ? 'success' : 'failed',
      span,
      ms: span.ms,
    };
  }

  return states;
}

/**
 * 将编排类节点（start/end/branch/condition/subgraph）标记为已走过路径。
 *
 * @param graph - 工作流图定义
 * @param states - 可变节点状态表
 */
export function markOrchestrationNodesOnExecutedPath(
  graph: WorkflowGraphDefinition,
  states: Record<string, WorkflowNodeExecutionState>,
): void {
  const executedOrRunning = new Set(
    Object.entries(states)
      .filter(([, state]) => state.status === 'success' || state.status === 'failed' || state.status === 'running')
      .map(([id]) => id),
  );

  for (const node of graph.nodes) {
    if (node.kind === 'tool') continue;
    if (states[node.id]?.status !== 'pending') continue;

    const descendants = collectDescendantNodeIds(graph, node.id);
    if ([...descendants].some((id) => executedOrRunning.has(id))) {
      states[node.id] = { status: 'success' };
    }
  }

  const startNode = graph.nodes.find((node) => node.kind === 'start');
  if (startNode && executedOrRunning.size > 0 && states[startNode.id]?.status === 'pending') {
    states[startNode.id] = { status: 'success' };
  }

  const endNode = graph.nodes.find((node) => node.kind === 'end');
  if (endNode) {
    const anyExecuted = Object.values(states).some(
      (state) => state.status === 'success' || state.status === 'failed' || state.status === 'running',
    );
    if (anyExecuted && states[endNode.id]?.status === 'pending') {
      const anyFailed = Object.values(states).some((state) => state.status === 'failed');
      states[endNode.id] = { status: anyFailed ? 'failed' : 'success' };
    }
  }
}

/**
 * 计算应高亮的边：source 已执行且 target 已执行或 running。
 *
 * @param graph - 工作流图定义
 * @param states - 节点执行状态
 * @returns 边 id 列表
 */
export function resolveActiveExecutionEdgeIds(
  graph: WorkflowGraphDefinition,
  states: Record<string, WorkflowNodeExecutionState>,
): string[] {
  const activeStatuses = new Set<WorkflowNodeExecutionStatus>(['success', 'failed', 'running']);
  return graph.edges
    .filter((edge) => {
      const source = states[edge.source];
      const target = states[edge.target];
      return (
        source != null
        && target != null
        && activeStatuses.has(source.status)
        && activeStatuses.has(target.status)
      );
    })
    .map((edge) => edge.id);
}

/**
 * 解析正在传递 state 的边及摘要（源 success、目标 running）。
 *
 * @param graph - 工作流图定义
 * @param states - 节点执行状态
 * @returns 流动边 id 与 edgeId → digest
 */
export function resolveFlowingExecutionEdges(
  graph: WorkflowGraphDefinition,
  states: Record<string, WorkflowNodeExecutionState>,
): { flowingEdgeIds: string[]; edgeTransfers: Record<string, string>; edgeTransferPayloads: Record<string, string> } {
  const flowingEdgeIds: string[] = [];
  const edgeTransfers: Record<string, string> = {};
  const edgeTransferPayloads: Record<string, string> = {};

  for (const edge of graph.edges) {
    const source = states[edge.source];
    const target = states[edge.target];
    if (source?.status !== 'success' || target?.status !== 'running') continue;

    flowingEdgeIds.push(edge.id);
    const rawDigest = source.span?.outputDigest?.trim();
    if (rawDigest) {
      const formatted = formatWorkflowTransferJson(rawDigest);
      edgeTransferPayloads[edge.id] = formatted;
      edgeTransfers[edge.id] = previewWorkflowTransferText(formatted);
    }
  }

  return { flowingEdgeIds, edgeTransfers, edgeTransferPayloads };
}

/**
 * 解析条件节点分支边的命中/跳过状态。
 *
 * @param graph - 工作流图定义
 * @param routedIntent - 路由意图；为空时不标记
 * @returns 命中/跳过分支边与分支节点 id
 */
export function resolveBranchEdgeVisualization(
  graph: WorkflowGraphDefinition,
  routedIntent: string | undefined,
): {
  takenBranchEdgeIds: string[];
  skippedBranchEdgeIds: string[];
  takenBranchNodeId: string | null;
} {
  if (!routedIntent?.trim()) {
    return { takenBranchEdgeIds: [], skippedBranchEdgeIds: [], takenBranchNodeId: null };
  }

  const takenBranchNodeId = resolveBranchNodeIdFromRoutedIntent(routedIntent);
  const takenBranchEdgeIds: string[] = [];
  const skippedBranchEdgeIds: string[] = [];

  const conditionNodeIds = new Set(
    graph.nodes.filter((node) => node.kind === 'condition').map((node) => node.id),
  );

  for (const edge of graph.edges) {
    if (!conditionNodeIds.has(edge.source)) continue;
    const targetNode = graph.nodes.find((node) => node.id === edge.target);
    if (targetNode?.kind !== 'branch') continue;

    if (edge.target === takenBranchNodeId) {
      takenBranchEdgeIds.push(edge.id);
    } else {
      skippedBranchEdgeIds.push(edge.id);
    }
  }

  return { takenBranchEdgeIds, skippedBranchEdgeIds, takenBranchNodeId };
}

/**
 * 合并分支可视化字段到执行快照。
 *
 * @param graph - 工作流图定义
 * @param snapshot - 当前快照
 * @param routedIntent - 路由意图
 * @returns 更新后的快照
 */
export function enrichWorkflowExecutionWithBranchState(
  graph: WorkflowGraphDefinition,
  snapshot: WorkflowGraphExecutionSnapshot,
  routedIntent: string | undefined,
): WorkflowGraphExecutionSnapshot {
  const branch = resolveBranchEdgeVisualization(graph, routedIntent);
  const nodeStates = { ...snapshot.nodeStates };

  if (branch.takenBranchNodeId) {
    for (const node of graph.nodes) {
      if (node.kind !== 'branch') continue;
      if (node.id === branch.takenBranchNodeId) {
        if (nodeStates[node.id]?.status === 'pending') {
          nodeStates[node.id] = { status: 'success' };
        }
      }
    }
    markOrchestrationNodesOnExecutedPath(graph, nodeStates);
  }

  return {
    ...snapshot,
    nodeStates,
    routedIntent,
    takenBranchNodeId: branch.takenBranchNodeId,
    takenBranchEdgeIds: branch.takenBranchEdgeIds,
    skippedBranchEdgeIds: branch.skippedBranchEdgeIds,
    ...resolveExecutionEdgeSnapshot(graph, nodeStates),
  };
}

/**
 * 合并 active / flowing 边信息到执行快照字段。
 *
 * @param graph - 工作流图定义
 * @param nodeStates - 节点执行状态
 * @returns activeEdgeIds、flowingEdgeIds、edgeTransfers
 */
function resolveExecutionEdgeSnapshot(
  graph: WorkflowGraphDefinition,
  nodeStates: Record<string, WorkflowNodeExecutionState>,
): Pick<
  WorkflowGraphExecutionSnapshot,
  'activeEdgeIds' | 'flowingEdgeIds' | 'edgeTransfers' | 'edgeTransferPayloads'
> {
  const { flowingEdgeIds, edgeTransfers, edgeTransferPayloads } = resolveFlowingExecutionEdges(
    graph,
    nodeStates,
  );
  return {
    activeEdgeIds: resolveActiveExecutionEdgeIds(graph, nodeStates),
    flowingEdgeIds,
    edgeTransfers,
    edgeTransferPayloads,
  };
}

/**
 * 创建空的分支可视化字段默认值。
 *
 * @returns 分支相关空字段
 */
function emptyBranchExecutionFields(): Pick<
  WorkflowGraphExecutionSnapshot,
  'takenBranchEdgeIds' | 'skippedBranchEdgeIds' | 'takenBranchNodeId' | 'routedIntent'
> {
  return {
    takenBranchEdgeIds: [],
    skippedBranchEdgeIds: [],
    takenBranchNodeId: null,
    routedIntent: undefined,
  };
}

/**
 * 由完整 trace 构建画布执行快照（M1 静态高亮）。
 *
 * @param graph - 工作流图定义
 * @param spans - NodeSpan 时间线
 * @returns 整图执行快照
 */
export function buildWorkflowGraphExecutionFromTrace(
  graph: WorkflowGraphDefinition,
  spans: AgentToolTraceEntry[],
  options?: { lastRoutedIntent?: string },
): WorkflowGraphExecutionSnapshot {
  const nodeStates = mapToolTraceSpansToGraphNodes(graph, spans);
  markOrchestrationNodesOnExecutedPath(graph, nodeStates);

  const failed = spans.some((span) => !span.ok)
    || Object.values(nodeStates).some((state) => state.status === 'failed');

  let snapshot: WorkflowGraphExecutionSnapshot = {
    nodeStates,
    ...resolveExecutionEdgeSnapshot(graph, nodeStates),
    ...emptyBranchExecutionFields(),
    completed: true,
    failed,
  };

  const routedIntent =
    options?.lastRoutedIntent
    ?? spans.map((span) => tryExtractRoutedIntentFromDigest(span.outputDigest)).find(Boolean);

  if (routedIntent) {
    snapshot = enrichWorkflowExecutionWithBranchState(graph, snapshot, routedIntent);
  }

  return snapshot;
}

/**
 * 将 SSE `tool_call` 事件合并进当前执行快照（M2 实时更新）。
 *
 * @param graph - 工作流图定义
 * @param current - 当前快照；首次传空节点表
 * @param payload - SSE tool_call 载荷
 * @returns 更新后的快照
 */
export function applyWorkflowGraphExecutionToolCall(
  graph: WorkflowGraphDefinition,
  current: WorkflowGraphExecutionSnapshot | null,
  payload: PlanSessionStreamToolCallPayload,
): WorkflowGraphExecutionSnapshot {
  const baseStates: Record<string, WorkflowNodeExecutionState> = {};
  for (const node of graph.nodes) {
    baseStates[node.id] = current?.nodeStates[node.id] ?? { status: 'pending' };
  }

  const toolName = normalizeExecutionToolName(payload.tool);
  const topoOrder = sortWorkflowGraphNodeIdsTopologically(graph);
  const matchingNodeIds = topoOrder.filter((nodeId) => {
    const node = graph.nodes.find((item) => item.id === nodeId);
    return node?.kind === 'tool' && node.toolName === toolName;
  });

  let targetNodeId: string | undefined;
  if (payload.status === 'running') {
    targetNodeId = matchingNodeIds.find((nodeId) => baseStates[nodeId]?.status === 'pending')
      ?? matchingNodeIds.find((nodeId) => baseStates[nodeId]?.status === 'running');
  } else {
    targetNodeId = matchingNodeIds.find((nodeId) => baseStates[nodeId]?.status === 'running')
      ?? matchingNodeIds.find((nodeId) => baseStates[nodeId]?.status === 'pending');
  }

  if (targetNodeId) {
    if (payload.status === 'running') {
      baseStates[targetNodeId] = { status: 'running', ms: payload.ms };
    } else {
      baseStates[targetNodeId] = {
        status: payload.status === 'done' ? 'success' : 'failed',
        ms: payload.ms,
        span: {
          tool: payload.tool,
          ok: payload.status === 'done',
          ms: payload.ms ?? 0,
          nodeId: payload.nodeId,
          inputDigest: payload.inputDigest,
          outputDigest: payload.outputDigest,
        },
      };
    }
  }

  if (payload.status === 'running' && graph.nodes.some((node) => node.kind === 'start')) {
    const startNode = graph.nodes.find((node) => node.kind === 'start');
    if (startNode && baseStates[startNode.id]?.status === 'pending') {
      baseStates[startNode.id] = { status: 'success' };
    }
  }

  markOrchestrationNodesOnExecutedPath(graph, baseStates);

  const runningTool = payload.status === 'running' ? payload.tool : undefined;

  let snapshot: WorkflowGraphExecutionSnapshot = {
    nodeStates: baseStates,
    ...resolveExecutionEdgeSnapshot(graph, baseStates),
    takenBranchEdgeIds: current?.takenBranchEdgeIds ?? [],
    skippedBranchEdgeIds: current?.skippedBranchEdgeIds ?? [],
    takenBranchNodeId: current?.takenBranchNodeId ?? null,
    routedIntent: current?.routedIntent,
    runningTool,
    completed: current?.completed ?? false,
    failed: current?.failed ?? false,
  };

  let routedIntent = snapshot.routedIntent;
  if (payload.tool === 'parse_intent' && payload.status === 'done') {
    routedIntent = tryExtractRoutedIntentFromDigest(payload.outputDigest) ?? routedIntent;
  }
  if (routedIntent && routedIntent !== snapshot.routedIntent) {
    snapshot = enrichWorkflowExecutionWithBranchState(graph, snapshot, routedIntent);
    snapshot.runningTool = runningTool;
    snapshot.completed = current?.completed ?? false;
    snapshot.failed = current?.failed ?? false;
  }

  return snapshot;
}
