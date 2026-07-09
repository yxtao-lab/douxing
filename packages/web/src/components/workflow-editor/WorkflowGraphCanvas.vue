<template>
  <div
    class="workflow-graph-canvas"
    @drop="onDrop"
    @dragover="onDragOver"
  >
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :default-edge-options="defaultEdgeOptions"
      :delete-key-code="['Delete', 'Backspace']"
      fit-view-on-init
      tabindex="0"
      class="workflow-graph-canvas__flow"
      @connect="onConnect"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
    >
      <Background pattern-color="#e8e8e8" :gap="16" />
      <Controls />
      <MiniMap />
      <WorkflowCanvasToolbar
        :can-undo="canUndo"
        :can-redo="canRedo"
        :timeline-entries="timelineEntries"
        @undo="undoGraph"
        @redo="redoGraph"
        @jump="jumpToHistory"
        @clear-history="clearHistoryStack"
      />
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { markRaw, nextTick, onMounted, onUnmounted, provide, ref, shallowRef, watch, type Component } from 'vue';
import {
  VueFlow,
  useVueFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';
import type { WorkflowGraphDefinition, WorkflowGraphExecutionSnapshot } from '@douxing/shared';
import WorkflowGraphNode from './WorkflowGraphNode.vue';
import WorkflowGraphTransferEdge from './WorkflowGraphTransferEdge.vue';
import {
  createUniqueWorkflowEdgeId,
  createUniqueWorkflowNodeId,
  flowToGraphDefinition,
  graphDefinitionToFlow,
  readFlowNodeData,
  readWorkflowEditorDragPayload,
  type WorkflowFlowEdgeSnapshot,
  type WorkflowFlowNodeSnapshot,
} from '@/utils/workflow-graph-flow';
import { isWorkflowNodeDeletable } from '@/utils/workflow-graph-node-actions';
import {
  useWorkflowGraphHistory,
  type WorkflowGraphHistoryActionKind,
} from '@/composables/useWorkflowGraphHistory';
import WorkflowCanvasToolbar from './WorkflowCanvasToolbar.vue';
import {
  WORKFLOW_SANDBOX_INJECT_KEY,
  type WorkflowSandboxInjectContext,
} from '@/utils/workflow-sandbox-inject';

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
  execution?: WorkflowGraphExecutionSnapshot | null;
  sandboxPrompt?: string;
  sandboxRunning?: boolean;
}>();

const emit = defineEmits<{
  change: [graph: WorkflowGraphDefinition];
  'node-select': [node: WorkflowFlowNodeSnapshot | null];
  'update:sandboxPrompt': [value: string];
  'sandbox-run': [];
}>();

const sandboxPromptLocal = ref(props.sandboxPrompt ?? '');
const sandboxRunningLocal = ref(props.sandboxRunning ?? false);

watch(
  () => props.sandboxPrompt,
  (value) => {
    sandboxPromptLocal.value = value ?? '';
  },
);

watch(
  () => props.sandboxRunning,
  (value) => {
    sandboxRunningLocal.value = value ?? false;
  },
);

/** 开始节点沙箱输入上下文 */
provide(WORKFLOW_SANDBOX_INJECT_KEY, {
  prompt: sandboxPromptLocal,
  running: sandboxRunningLocal,
  setPrompt: (value: string) => {
    sandboxPromptLocal.value = value;
    emit('update:sandboxPrompt', value);
  },
  run: () => emit('sandbox-run'),
} satisfies WorkflowSandboxInjectContext);

const nodeTypes: Record<string, Component> = {
  workflowNode: markRaw(WorkflowGraphNode),
};

const edgeTypes: Record<string, Component> = {
  workflowTransfer: markRaw(WorkflowGraphTransferEdge),
};

const defaultEdgeOptions = {
  animated: true,
};

const nodes = shallowRef<Node[]>([]);
const edges = shallowRef<Edge[]>([]);
let graphLoaded = false;
/** 撤销/重做回放中，避免再次写入历史栈 */
let applyingHistory = false;
/** Tool overrides 防抖写入历史 */
let overrideHistoryTimer: ReturnType<typeof setTimeout> | null = null;

const history = useWorkflowGraphHistory();
const { canUndo, canRedo, timelineEntries } = history;
const { screenToFlowCoordinate, getSelectedNodes, addNodes, addEdges, updateNode, setNodes, setEdges, getNodes, getEdges } =
  useVueFlow();

/**
 * 从节点变更推断历史动作类型。
 *
 * @param changes - Vue Flow 节点变更
 * @returns 动作类型；无需记录时为 null
 */
function inferNodeChangeAction(changes: NodeChange[]): WorkflowGraphHistoryActionKind | null {
  if (changes.some((change) => change.type === 'add')) return 'nodeAdded';
  if (changes.some((change) => change.type === 'remove')) return 'nodeRemoved';
  if (changes.some((change) => change.type === 'position' && change.dragging === false)) {
    return 'nodeMoved';
  }
  return null;
}

/**
 * 从边变更推断历史动作类型。
 *
 * @param changes - Vue Flow 边变更
 * @returns 动作类型；无需记录时为 null
 */
function inferEdgeChangeAction(changes: EdgeChange[]): WorkflowGraphHistoryActionKind | null {
  if (changes.some((change) => change.type === 'add')) return 'edgeConnected';
  if (changes.some((change) => change.type === 'remove')) return 'edgeRemoved';
  return null;
}

/**
 * 同步图定义到父组件，并按需写入历史栈。
 * 增删节点/边时延迟到 nextTick，确保 Vue Flow 内部状态与 v-model 已更新。
 *
 * @param record - 是否记录为可撤销步骤
 * @param action - 变更动作类型
 */
function syncGraphChange(record = false, action?: WorkflowGraphHistoryActionKind): void {
  const flush = (): void => {
    const graph = getCurrentGraph();
    emit('change', graph);
    if (record && !applyingHistory && action) {
      history.recordHistory(graph, action);
    }
  };

  if (record && action) {
    nextTick(flush);
    return;
  }

  flush();
}

/**
 * 判断节点变更是否应写入历史（拖拽仅在结束时记录一次）。
 *
 * @param changes - Vue Flow 节点变更
 * @returns 是否记录历史
 */
function shouldRecordNodeChanges(changes: NodeChange[]): boolean {
  return changes.some((change) => {
    if (change.type === 'add' || change.type === 'remove') return true;
    if (change.type === 'position' && change.dragging === false) return true;
    return false;
  });
}

/**
 * 判断边变更是否应写入历史。
 *
 * @param changes - Vue Flow 边变更
 * @returns 是否记录历史
 */
function shouldRecordEdgeChanges(changes: EdgeChange[]): boolean {
  return changes.some((change) => change.type === 'add' || change.type === 'remove');
}

/**
 * 节点变更：同步图定义；删除时清空右侧选中态。
 *
 * @param changes - Vue Flow 节点变更列表
 */
function onNodesChange(changes: NodeChange[]): void {
  if (changes.some((change) => change.type === 'remove')) {
    emit('node-select', null);
  }
  const action = inferNodeChangeAction(changes);
  syncGraphChange(shouldRecordNodeChanges(changes) && !!action, action ?? undefined);
}

/**
 * 边变更：同步图定义并在增删边时记录历史。
 *
 * @param changes - Vue Flow 边变更列表
 */
function onEdgesChange(changes: EdgeChange[]): void {
  const action = inferEdgeChangeAction(changes);
  syncGraphChange(shouldRecordEdgeChanges(changes) && !!action, action ?? undefined);
}

/**
 * 将图定义同步到 Vue Flow 画布（撤销/重做需走 setNodes/setEdges）。
 *
 * @param graph - DAG 定义
 */
function syncFlowFromGraph(graph: WorkflowGraphDefinition): void {
  const flow = graphDefinitionToFlow(graph);
  const nextNodes = flow.nodes as Node[];
  const nextEdges = flow.edges as Edge[];
  nodes.value = nextNodes;
  edges.value = nextEdges;
  setNodes(nextNodes);
  setEdges(nextEdges);
}

/**
 * 应用历史图到画布（撤销/重做/跳转共用）。
 *
 * @param graph - 目标图定义
 */
function applyHistoryGraph(graph: WorkflowGraphDefinition): void {
  applyingHistory = true;
  syncFlowFromGraph(graph);
  applyingHistory = false;
  emit('node-select', null);
  syncGraphChange(false);
}

/**
 * 撤销一步并刷新画布。
 *
 * @returns 是否成功撤销
 */
function undoGraph(): boolean {
  const graph = history.undo();
  if (!graph) return false;
  applyHistoryGraph(graph);
  return true;
}

/**
 * 重做一步并刷新画布。
 *
 * @returns 是否成功重做
 */
function redoGraph(): boolean {
  const graph = history.redo();
  if (!graph) return false;
  applyHistoryGraph(graph);
  return true;
}

/**
 * 跳转到变更历史中的指定步。
 *
 * @param stepsBack - 相对当前的撤销步数
 */
function jumpToHistory(stepsBack: number): void {
  const graph = history.goToStepsBack(stepsBack);
  if (!graph) return;
  applyHistoryGraph(graph);
}

/**
 * 清除撤销/重做栈，保留当前画布状态。
 */
function clearHistoryStack(): void {
  history.clearHistory();
}

/**
 * 复制当前选中的可编辑节点（Ctrl+D）。
 */
function duplicateSelectedNodes(): void {
  const selected = getSelectedNodes.value.filter((node) => {
    const data = readFlowNodeData({ id: node.id, position: node.position, data: node.data });
    return isWorkflowNodeDeletable(data.kind);
  });
  if (selected.length === 0) return;

  const existingIds = new Set(nodes.value.map((node) => node.id));
  for (const source of selected) {
    const nextId = createUniqueWorkflowNodeId(`${source.id}_copy`, existingIds);
    existingIds.add(nextId);
    addNodes([
      {
        id: nextId,
        type: source.type ?? 'workflowNode',
        position: {
          x: source.position.x + 48,
          y: source.position.y + 32,
        },
        data: source.data ? { ...source.data } : {},
      },
    ]);
    updateNode(source.id, (node) => ({ ...node, selected: false }));
    updateNode(nextId, (node) => ({ ...node, selected: true }));
  }
}

/**
 * 键盘快捷键：Delete 由 Vue Flow 处理；Ctrl+D 复制选中节点。
 *
 * @param event - 键盘事件
 */
function onCanvasKeyDown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  ) {
    return;
  }

  const isCopyShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd';
  if (isCopyShortcut) {
    event.preventDefault();
    duplicateSelectedNodes();
    return;
  }

  const isUndoShortcut = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
  if (isUndoShortcut) {
    event.preventDefault();
    undoGraph();
    return;
  }

  const isRedoShortcut =
    (event.ctrlKey || event.metaKey) &&
    (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'));
  if (isRedoShortcut) {
    event.preventDefault();
    redoGraph();
  }
}

/** 挂载画布级快捷键监听 */
onMounted(() => {
  window.addEventListener('keydown', onCanvasKeyDown);
});

/** 卸载快捷键监听 */
onUnmounted(() => {
  window.removeEventListener('keydown', onCanvasKeyDown);
  if (overrideHistoryTimer) clearTimeout(overrideHistoryTimer);
});

/**
 * 从 props 加载图到画布。
 *
 * @param graph - DAG 定义
 * @param resetHistory - 是否重置撤销/重做栈
 * @param resetAction - 重置时的基线动作标签
 */
function loadGraph(
  graph: WorkflowGraphDefinition,
  resetHistory = false,
  resetAction: WorkflowGraphHistoryActionKind = 'sessionStart',
): void {
  syncFlowFromGraph(graph);
  if (resetHistory) {
    history.initHistory(getCurrentGraph(), resetAction);
  }
}

watch(
  () => props.graph,
  (graph) => {
    if (graphLoaded) return;
    loadGraph(graph, true);
    graphLoaded = true;
    syncGraphChange(false);
  },
  { immediate: true, deep: true },
);

/**
 * 将执行快照合并到画布节点与边样式（沙箱高亮）。
 *
 * @param execution - 执行快照；null 时清除高亮
 */
function applyExecutionOverlay(execution: WorkflowGraphExecutionSnapshot | null | undefined): void {
  const activeEdgeSet = new Set(execution?.activeEdgeIds ?? []);
  const flowingEdgeSet = new Set(execution?.flowingEdgeIds ?? []);
  const takenBranchEdgeSet = new Set(execution?.takenBranchEdgeIds ?? []);
  const skippedBranchEdgeSet = new Set(execution?.skippedBranchEdgeIds ?? []);
  const edgeTransfers = execution?.edgeTransfers ?? {};
  const edgeTransferPayloads = execution?.edgeTransferPayloads ?? {};

  const nextNodes = getNodes.value.map((node) => {
    const data = readFlowNodeData(node);
    const status = execution?.nodeStates[node.id]?.status;
    return {
      ...node,
      data: {
        ...data,
        executionStatus: status,
        routedIntent: execution?.routedIntent,
        takenBranchNodeId: execution?.takenBranchNodeId,
        isTakenBranch: execution?.takenBranchNodeId === node.id,
      },
    };
  });

  const nextEdges = getEdges.value.map((edge) => {
    const isActive = activeEdgeSet.has(edge.id);
    const isFlowing = flowingEdgeSet.has(edge.id);
    const isTakenBranch = takenBranchEdgeSet.has(edge.id);
    const isSkippedBranch = skippedBranchEdgeSet.has(edge.id);
    const staticLabel = typeof edge.label === 'string' ? edge.label : undefined;

    const branchState = isTakenBranch ? 'taken' as const : isSkippedBranch ? 'skipped' as const : 'none' as const;
    const executionMode = isFlowing ? 'flowing' as const : isActive ? 'active' as const : 'idle' as const;

    if (!execution) {
      return {
        ...edge,
        type: undefined,
        animated: true,
        label: staticLabel,
        data: undefined,
        class: undefined,
        style: undefined,
        labelStyle: undefined,
        labelBgStyle: undefined,
      };
    }

    return {
      ...edge,
      type: 'workflowTransfer',
      animated: isFlowing || isActive || isTakenBranch,
      label: undefined,
      data: {
        transferPreview: edgeTransfers[edge.id],
        transferJson: edgeTransferPayloads[edge.id],
        branchState,
        executionMode,
        staticLabel,
      },
      class: isFlowing ? 'workflow-edge--flowing' : undefined,
      style: undefined,
      labelStyle: undefined,
      labelBgStyle: undefined,
    };
  });

  setNodes(nextNodes);
  setEdges(nextEdges);
  nodes.value = nextNodes;
  edges.value = nextEdges;
}

watch(
  () => props.execution,
  (execution) => {
    applyExecutionOverlay(execution);
  },
  { deep: true },
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

  const graph = getCurrentGraph();
  emit('change', graph);
  if (applyingHistory) return;

  if (overrideHistoryTimer) clearTimeout(overrideHistoryTimer);
  overrideHistoryTimer = setTimeout(() => {
    history.recordHistory(getCurrentGraph(), 'configChanged');
    overrideHistoryTimer = null;
  }, 400);
}

/**
 * 处理拖拽放置新节点。
 *
 * @param event - drop 事件
 */
function onDrop(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();

  const payload = readWorkflowEditorDragPayload(event);
  if (!payload) return;

  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY });
  const existingIds = new Set(nodes.value.map((n) => n.id));
  const prefix = payload.toolName ?? payload.id ?? payload.kind;
  const nodeId = createUniqueWorkflowNodeId(prefix, existingIds);

  addNodes([
    {
      id: nodeId,
      type: 'workflowNode',
      position,
      data: {
        kind: payload.kind,
        toolName: payload.toolName,
        labelKey: payload.labelKey,
      },
    },
  ]);
}

/**
 * 允许面板拖拽进入画布。
 *
 * @param event - dragover 事件
 */
function onDragOver(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();
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
  if (connection.source === connection.target) return;

  const duplicate = edges.value.some(
    (edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null) &&
      (edge.targetHandle ?? null) === (connection.targetHandle ?? null),
  );
  if (duplicate) return;

  const existingEdgeIds = new Set(edges.value.map((edge) => edge.id));
  const edgeId = createUniqueWorkflowEdgeId(connection.source, connection.target, existingEdgeIds);

  addEdges([
    {
      id: edgeId,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
      animated: true,
    },
  ]);
}

/**
 * 供父组件读取当前图（保存前）。
 *
 * @returns 当前 DAG 定义
 */
function getCurrentGraph(): WorkflowGraphDefinition {
  return flowToGraphDefinition(
    getNodes.value.map(toNodeSnapshot),
    getEdges.value.map(toEdgeSnapshot),
  );
}

/**
 * 强制从外部图定义重载画布（如「加载默认图」）。
 *
 * @param graph - DAG 定义
 */
function reloadGraph(graph: WorkflowGraphDefinition): void {
  applyingHistory = true;
  loadGraph(graph, true, 'graphReloaded');
  graphLoaded = true;
  applyingHistory = false;
  syncGraphChange(false);
}

/**
 * 取消画布上所有节点的选中态（左侧面板选中目录项时调用）。
 */
function clearNodeSelection(): void {
  for (const node of getNodes.value) {
    if (node.selected) {
      updateNode(node.id, (current) => ({ ...current, selected: false }));
    }
  }
}

defineExpose({
  getCurrentGraph,
  loadGraph,
  reloadGraph,
  updateNodeOverrides,
  duplicateSelectedNodes,
  undoGraph,
  redoGraph,
  clearNodeSelection,
});
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

.workflow-graph-canvas__flow:focus {
  outline: none;
}

.workflow-graph-canvas :deep(.workflow-edge--flowing path) {
  stroke-dasharray: 10 6;
  animation: workflow-edge-flow 0.8s linear infinite;
}

@keyframes workflow-edge-flow {
  from {
    stroke-dashoffset: 16;
  }

  to {
    stroke-dashoffset: 0;
  }
}
</style>
