<template>
  <div class="workflow-graph-canvas">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :default-edge-options="defaultEdgeOptions"
      fit-view-on-init
      @connect="onConnect"
      @drop="onDrop"
      @dragover="onDragOver"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
      @nodes-change="emitGraphChangeDebounced"
      @edges-change="emitGraphChangeDebounced"
    >
      <Background pattern-color="#e8e8e8" :gap="16" />
      <Controls />
      <MiniMap />
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { markRaw, shallowRef, watch, type Component } from 'vue';
import {
  VueFlow,
  useVueFlow,
  type Connection,
  type Edge,
  type Node,
} from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';
import type { WorkflowGraphDefinition } from '@douxing/shared';
import WorkflowGraphNode from './WorkflowGraphNode.vue';
import {
  WORKFLOW_EDITOR_DRAG_MIME,
  createUniqueWorkflowEdgeId,
  createUniqueWorkflowNodeId,
  flowToGraphDefinition,
  graphDefinitionToFlow,
  readFlowNodeData,
  type WorkflowFlowNodeData,
  type WorkflowFlowEdgeSnapshot,
  type WorkflowFlowNodeSnapshot,
} from '@/utils/workflow-graph-flow';

/**
 * 将 Vue Flow 节点转为序列化快照。
 *
 * @param node - Vue Flow 节点
 * @returns 轻量快照
 */
function toNodeSnapshot(node: Node): WorkflowFlowNodeSnapshot {
  return {
    id: node.id,
    position: { x: node.position.x, y: node.position.y },
    data: node.data,
  };
}

/**
 * 将 Vue Flow 边转为序列化快照。
 *
 * @param edge - Vue Flow 边
 * @returns 轻量快照
 */
function toEdgeSnapshot(edge: Edge): WorkflowFlowEdgeSnapshot {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: typeof edge.label === 'string' ? edge.label : undefined,
  };
}

const props = defineProps<{
  graph: WorkflowGraphDefinition;
}>();

const emit = defineEmits<{
  change: [graph: WorkflowGraphDefinition];
  'node-select': [node: WorkflowFlowNodeSnapshot | null];
}>();

const nodeTypes: Record<string, Component> = {
  workflowNode: markRaw(WorkflowGraphNode),
};

const defaultEdgeOptions = {
  animated: true,
};

const nodes = shallowRef<Node[]>([]);
const edges = shallowRef<Edge[]>([]);
let graphLoaded = false;

const { screenToFlowCoordinate } = useVueFlow();

/**
 * 将当前 Vue Flow 状态同步给父组件。
 */
function emitGraphChange(): void {
  const graph = flowToGraphDefinition(
    nodes.value.map(toNodeSnapshot),
    edges.value.map(toEdgeSnapshot),
  );
  emit('change', graph);
}

/**
 * 防抖同步，避免拖拽过程中频繁触发校验。
 */
function emitGraphChangeDebounced(): void {
  emitGraphChange();
}

/**
 * 从 props 加载图到画布。
 *
 * @param graph - DAG 定义
 */
function loadGraph(graph: WorkflowGraphDefinition): void {
  const flow = graphDefinitionToFlow(graph);
  nodes.value = flow.nodes;
  edges.value = flow.edges;
}

watch(
  () => props.graph,
  (graph) => {
    if (graphLoaded) return;
    loadGraph(graph);
    graphLoaded = true;
  },
  { immediate: true, deep: true },
);

/**
 * 节点点击：通知父组件展示属性面板。
 *
 * @param event - Vue Flow 节点点击事件
 */
function onNodeClick(event: { node: Node }): void {
  emit('node-select', toNodeSnapshot(event.node));
}

/**
 * 点击画布空白处取消选中。
 */
function onPaneClick(): void {
  emit('node-select', null);
}

/**
 * 更新指定 Tool 节点的 overrides 并同步图定义。
 *
 * @param nodeId - 节点 ID
 * @param overrides - 静态入参覆盖；undefined 表示清空
 */
function updateNodeOverrides(
  nodeId: string,
  overrides: Record<string, unknown> | undefined,
): void {
  nodes.value = nodes.value.map((node) => {
    if (node.id !== nodeId) return node;
    const data = readFlowNodeData(node);
    const nextConfig = { ...(data.config ?? {}) };
    if (overrides) {
      nextConfig.overrides = overrides;
    } else {
      delete nextConfig.overrides;
    }
    return {
      ...node,
      data: {
        ...data,
        config: Object.keys(nextConfig).length > 0 ? nextConfig : undefined,
      },
    };
  });
  emitGraphChange();
}

/**
 * 处理拖拽放置新节点。
 *
 * @param event - drop 事件
 */
function onDrop(event: DragEvent): void {
  event.preventDefault();
  const raw = event.dataTransfer?.getData(WORKFLOW_EDITOR_DRAG_MIME);
  if (!raw) return;

  let payload: {
    kind: WorkflowFlowNodeData['kind'];
    toolName?: string;
    id?: string;
    labelKey?: string;
  };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    return;
  }

  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY });
  const existingIds = new Set(nodes.value.map((n) => n.id));
  const prefix = payload.toolName ?? payload.id ?? payload.kind;
  const nodeId = createUniqueWorkflowNodeId(prefix, existingIds);

  nodes.value.push({
    id: nodeId,
    type: 'workflowNode',
    position,
    data: {
      kind: payload.kind,
      toolName: payload.toolName,
      labelKey: payload.labelKey,
    },
  });
  emitGraphChange();
}

/**
 * 允许面板拖拽进入画布。
 *
 * @param event - dragover 事件
 */
function onDragOver(event: DragEvent): void {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

/**
 * 连线时创建边并通知父组件。
 *
 * @param connection - Vue Flow 连接参数
 */
function onConnect(connection: Connection): void {
  if (!connection.source || !connection.target) return;
  const existingEdgeIds = new Set(edges.value.map((e) => e.id));
  const edgeId = createUniqueWorkflowEdgeId(connection.source, connection.target, existingEdgeIds);
  edges.value.push({
    id: edgeId,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle ?? undefined,
    targetHandle: connection.targetHandle ?? undefined,
    animated: true,
  });
  emitGraphChange();
}

/**
 * 供父组件读取当前图（保存前）。
 *
 * @returns 当前 DAG 定义
 */
function getCurrentGraph(): WorkflowGraphDefinition {
  return flowToGraphDefinition(
    nodes.value.map(toNodeSnapshot),
    edges.value.map(toEdgeSnapshot),
  );
}

/**
 * 强制从外部图定义重载画布（如「加载默认图」）。
 *
 * @param graph - DAG 定义
 */
function reloadGraph(graph: WorkflowGraphDefinition): void {
  loadGraph(graph);
  graphLoaded = true;
  emitGraphChange();
}

defineExpose({ getCurrentGraph, loadGraph, reloadGraph, updateNodeOverrides });
</script>

<style scoped>
.workflow-graph-canvas {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #fff;
}

.workflow-graph-canvas :deep(.vue-flow) {
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
