<template>
  <div class="workflow-node-palette">
    <a-collapse
      v-model:active-key="activeKeys"
      :bordered="false"
      class="workflow-node-palette__collapse"
    >
      <a-collapse-panel key="tools" :header="t('workflowEditor.paletteTools')">
        <div class="workflow-node-palette__grid">
          <a-button
            v-for="tool in WORKFLOW_EDITOR_TOOL_NAMES"
            :key="tool"
            size="small"
            block
            draggable="true"
            class="workflow-node-palette__item"
            :class="{ 'workflow-node-palette__item--selected': isItemSelected('tool', tool) }"
            @click="onItemClick('tool', { toolName: tool })"
            @dragstart="(e: DragEvent) => onDragStart(e, 'tool', { toolName: tool })"
          >
            <span class="workflow-node-palette__item-inner">
              <component :is="resolveWorkflowPaletteToolIcon(tool)" class="workflow-node-palette__icon" />
              <span class="workflow-node-palette__label">{{ toolLabel(tool) }}</span>
            </span>
          </a-button>
        </div>
      </a-collapse-panel>

      <a-collapse-panel key="orchestration" :header="t('workflowEditor.paletteOrchestration')">
        <div class="workflow-node-palette__grid">
          <a-button
            v-for="item in WORKFLOW_ORCHESTRATION_NODE_DEFS"
            :key="item.id"
            size="small"
            block
            draggable="true"
            class="workflow-node-palette__item"
            :class="{ 'workflow-node-palette__item--selected': isItemSelected('node', item.id) }"
            @click="onItemClick(item.kind, { id: item.id, labelKey: item.labelKey })"
            @dragstart="(e: DragEvent) => onDragStart(e, item.kind, { id: item.id, labelKey: item.labelKey })"
          >
            <span class="workflow-node-palette__item-inner">
              <component :is="resolveWorkflowPaletteNodeIcon(item.id)" class="workflow-node-palette__icon" />
              <span class="workflow-node-palette__label">{{ t(item.labelKey) }}</span>
            </span>
          </a-button>
          <a-button
            size="small"
            block
            draggable="true"
            class="workflow-node-palette__item"
            :class="{ 'workflow-node-palette__item--selected': isItemSelected('node', 'start') }"
            @click="onItemClick('start', { id: 'start', labelKey: 'workflowEditor.node.start' })"
            @dragstart="(e: DragEvent) => onDragStart(e, 'start', { id: 'start', labelKey: 'workflowEditor.node.start' })"
          >
            <span class="workflow-node-palette__item-inner">
              <component :is="resolveWorkflowPaletteNodeIcon('start')" class="workflow-node-palette__icon" />
              <span class="workflow-node-palette__label">{{ t('workflowEditor.node.start') }}</span>
            </span>
          </a-button>
          <a-button
            size="small"
            block
            draggable="true"
            class="workflow-node-palette__item"
            :class="{ 'workflow-node-palette__item--selected': isItemSelected('node', 'end') }"
            @click="onItemClick('end', { id: 'end', labelKey: 'workflowEditor.node.end' })"
            @dragstart="(e: DragEvent) => onDragStart(e, 'end', { id: 'end', labelKey: 'workflowEditor.node.end' })"
          >
            <span class="workflow-node-palette__item-inner">
              <component :is="resolveWorkflowPaletteNodeIcon('end')" class="workflow-node-palette__icon" />
              <span class="workflow-node-palette__label">{{ t('workflowEditor.node.end') }}</span>
            </span>
          </a-button>
        </div>
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  WORKFLOW_EDITOR_TOOL_NAMES,
  WORKFLOW_ORCHESTRATION_NODE_DEFS,
  type WorkflowGraphNodeKind,
} from '@douxing/shared';
import {
  WORKFLOW_EDITOR_DRAG_MIME,
  WORKFLOW_EDITOR_DRAG_PLAIN_KEY,
} from '@/utils/workflow-graph-flow';
import type { WorkflowPaletteSelection } from '@/utils/workflow-palette-selection';
import {
  resolveWorkflowPaletteNodeIcon,
  resolveWorkflowPaletteToolIcon,
} from '@/utils/workflow-palette-icons';

const props = defineProps<{
  /** 当前选中的面板项键 */
  selectedKey?: string | null;
}>();

const emit = defineEmits<{
  select: [selection: WorkflowPaletteSelection];
}>();

const { t } = useI18n();

/** 左侧面板默认展开分组 */
const activeKeys = ref(['tools', 'orchestration']);

/**
 * 获取 Tool 节点展示名。
 *
 * @param tool - Agent Tool 名
 * @returns 本地化标签或原始 tool 名
 */
function toolLabel(tool: string): string {
  const key = `agent.status.${tool}`;
  const translated = t(key);
  return translated !== key ? translated : tool;
}

/**
 * 判断面板项是否处于选中态。
 *
 * @param mode - tool 或 node 目录项
 * @param id - tool 名或 nodeId
 * @returns 是否选中
 */
function isItemSelected(mode: 'tool' | 'node', id: string): boolean {
  if (!props.selectedKey) return false;
  const key = mode === 'tool' ? `tool:${id}` : `node:${id}`;
  return props.selectedKey === key;
}

/**
 * 点击面板项：选中并通知父组件展示说明。
 *
 * @param kind - 节点种类
 * @param payload - 节点标识
 */
function onItemClick(
  kind: WorkflowGraphNodeKind,
  payload: { toolName?: string; id?: string; labelKey?: string },
): void {
  emit('select', {
    kind,
    toolName: payload.toolName,
    nodeId: payload.id,
    labelKey: payload.labelKey,
  });
}

/**
 * 开始从面板拖拽节点。
 *
 * @param event - 拖拽事件
 * @param kind - 节点种类
 * @param payload - 节点初始数据
 */
function onDragStart(
  event: DragEvent,
  kind: WorkflowGraphNodeKind,
  payload: { toolName?: string; id?: string; labelKey?: string },
): void {
  if (!event.dataTransfer) return;
  const json = JSON.stringify({
    kind,
    toolName: payload.toolName,
    id: payload.id,
    labelKey: payload.labelKey,
  });
  event.dataTransfer.setData(WORKFLOW_EDITOR_DRAG_MIME, json);
  event.dataTransfer.setData(WORKFLOW_EDITOR_DRAG_PLAIN_KEY, json);
  event.dataTransfer.effectAllowed = 'move';
  onItemClick(kind, payload);
}
</script>

<style scoped>
.workflow-node-palette {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #fafafa;
  border-right: 1px solid #f0f0f0;
}

.workflow-node-palette__collapse {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 8px;
}

.workflow-node-palette__collapse :deep(.ant-collapse-item) {
  margin-bottom: 8px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.workflow-node-palette__collapse :deep(.ant-collapse-header) {
  font-size: 12px;
  font-weight: 600;
  color: #595959;
}

.workflow-node-palette__collapse :deep(.ant-collapse-content-box) {
  padding: 8px;
}

.workflow-node-palette__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}

.workflow-node-palette__item {
  text-align: left;
  white-space: normal;
  height: auto;
  min-height: 32px;
  line-height: 1.3;
  padding: 6px 10px;
  cursor: grab;
  -webkit-user-drag: element;
  border-color: #d9d9d9;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.workflow-node-palette__item-inner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
}

.workflow-node-palette__icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 14px;
  line-height: 1;
  opacity: 0.85;
}

.workflow-node-palette__label {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.workflow-node-palette__item--selected .workflow-node-palette__icon {
  opacity: 1;
}

.workflow-node-palette__item--selected {
  border-color: #1677ff;
  background: #e6f4ff;
  color: #1677ff;
  font-weight: 600;
}

.workflow-node-palette__item--selected:hover {
  border-color: #1677ff;
  background: #e6f4ff;
  color: #1677ff;
}
</style>
