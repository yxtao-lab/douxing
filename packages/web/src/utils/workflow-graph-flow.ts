import type {
  WorkflowGraphDefinition,
  WorkflowGraphEdge,
  WorkflowGraphNode,
  WorkflowGraphNodeKind,
} from '@douxing/shared';
import { WORKFLOW_GRAPH_SCHEMA_VERSION } from '@douxing/shared';

/** Vue Flow 拖拽 MIME 类型（面板 → 画布） */
export const WORKFLOW_EDITOR_DRAG_MIME = 'application/vueflow';

/** Vue Flow 节点 data 载荷 */
export interface WorkflowFlowNodeData {
  kind: WorkflowGraphNodeKind;
  labelKey?: string;
  toolName?: string;
  config?: Record<string, unknown>;
}

/** 序列化用的轻量节点快照（避免 Vue Flow Node 泛型过深） */
export interface WorkflowFlowNodeSnapshot {
  id: string;
  position: { x: number; y: number };
  data?: unknown;
}

/** 序列化用的轻量边快照 */
export interface WorkflowFlowEdgeSnapshot {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
}

/**
 * 读取 Vue Flow 节点上的编排 data。
 *
 * @param node - Vue Flow 节点
 * @returns 节点 data 或空对象
 */
export function readFlowNodeData(node: WorkflowFlowNodeSnapshot): WorkflowFlowNodeData {
  const raw = node.data as WorkflowFlowNodeData | undefined;
  return raw ?? { kind: 'tool' };
}

/**
 * 将持久化 DAG 转为 Vue Flow 节点与边。
 *
 * @param graph - 工作流图定义
 * @returns Vue Flow 可用的 nodes / edges
 */
export function graphDefinitionToFlow(graph: WorkflowGraphDefinition): {
  nodes: WorkflowFlowNodeSnapshot[];
  edges: WorkflowFlowEdgeSnapshot[];
} {
  const nodes: WorkflowFlowNodeSnapshot[] = graph.nodes.map((node) => ({
    id: node.id,
    type: 'workflowNode',
    position: { ...node.position },
    data: {
      kind: node.kind,
      labelKey: node.labelKey,
      toolName: node.toolName,
      config: node.data,
    } satisfies WorkflowFlowNodeData,
  }));

  const edges: WorkflowFlowEdgeSnapshot[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    animated: true,
  }));

  return { nodes, edges };
}

/**
 * 将 Vue Flow 画布状态序列化为持久化 DAG。
 *
 * @param nodes - 当前画布节点
 * @param edges - 当前画布边
 * @returns 工作流图定义
 */
export function flowToGraphDefinition(
  nodes: WorkflowFlowNodeSnapshot[],
  edges: WorkflowFlowEdgeSnapshot[],
): WorkflowGraphDefinition {
  const graphNodes: WorkflowGraphNode[] = nodes.map((node) => {
    const data = readFlowNodeData(node);
    return {
      id: node.id,
      kind: data.kind ?? 'tool',
      labelKey: data.labelKey,
      toolName: data.toolName,
      position: { x: node.position.x, y: node.position.y },
      data: data.config,
    };
  });

  const graphEdges: WorkflowGraphEdge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    label: typeof edge.label === 'string' ? edge.label : undefined,
  }));

  return {
    schemaVersion: WORKFLOW_GRAPH_SCHEMA_VERSION,
    nodes: graphNodes,
    edges: graphEdges,
  };
}

/**
 * 生成画布内唯一节点 ID。
 *
 * @param prefix - ID 前缀（tool 名或节点类型）
 * @param existingIds - 已占用 ID 集合
 * @returns 未冲突的新 ID
 */
export function createUniqueWorkflowNodeId(prefix: string, existingIds: Set<string>): string {
  const base = prefix.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  let candidate = base;
  let index = 1;
  while (existingIds.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  return candidate;
}

/**
 * 生成画布内唯一边 ID。
 *
 * @param source - 源节点 ID
 * @param target - 目标节点 ID
 * @param existingIds - 已占用边 ID
 * @returns 未冲突的新边 ID
 */
export function createUniqueWorkflowEdgeId(
  source: string,
  target: string,
  existingIds: Set<string>,
): string {
  let candidate = `e-${source}-${target}`;
  let index = 1;
  while (existingIds.has(candidate)) {
    candidate = `e-${source}-${target}-${index}`;
    index += 1;
  }
  return candidate;
}
