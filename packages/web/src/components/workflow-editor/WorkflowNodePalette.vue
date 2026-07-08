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
            @dragstart="(e: DragEvent) => onDragStart(e, 'tool', { toolName: tool })"
          >
            {{ toolLabel(tool) }}
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
            @dragstart="(e: DragEvent) => onDragStart(e, item.kind, { id: item.id, labelKey: item.labelKey })"
          >
            {{ t(item.labelKey) }}
          </a-button>
          <a-button
            size="small"
            block
            draggable="true"
            class="workflow-node-palette__item"
            @dragstart="(e: DragEvent) => onDragStart(e, 'start', { id: 'start', labelKey: 'workflowEditor.node.start' })"
          >
            {{ t('workflowEditor.node.start') }}
          </a-button>
          <a-button
            size="small"
            block
            draggable="true"
            class="workflow-node-palette__item"
            @dragstart="(e: DragEvent) => onDragStart(e, 'end', { id: 'end', labelKey: 'workflowEditor.node.end' })"
          >
            {{ t('workflowEditor.node.end') }}
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
import { WORKFLOW_EDITOR_DRAG_MIME } from '@/utils/workflow-graph-flow';

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
  event.dataTransfer.setData(
    WORKFLOW_EDITOR_DRAG_MIME,
    JSON.stringify({
      kind,
      toolName: payload.toolName,
      id: payload.id,
      labelKey: payload.labelKey,
    }),
  );
  event.dataTransfer.effectAllowed = 'move';
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
  min-height: 28px;
  line-height: 1.3;
  padding-top: 4px;
  padding-bottom: 4px;
}
</style>
