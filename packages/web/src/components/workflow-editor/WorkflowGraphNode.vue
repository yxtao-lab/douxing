<template>
  <div
    class="workflow-graph-node"
    :class="[
      `workflow-graph-node--${data.kind}`,
      { 'workflow-graph-node--selected': props.selected },
    ]"
  >
    <a-dropdown
      v-if="deletable"
      :trigger="['click']"
      placement="bottom"
      @click.stop
    >
      <button
        type="button"
        class="workflow-graph-node__menu-trigger"
        :aria-label="t('workflowEditor.nodeAction.menu')"
        @click.stop
      >
        <EllipsisOutlined />
      </button>
      <template #overlay>
        <a-menu @click="onMenuClick">
          <a-menu-item key="copy">
            <span>{{ t('workflowEditor.nodeAction.copy') }}</span>
            <span class="workflow-graph-node__shortcut">{{ t('workflowEditor.nodeAction.shortcutCopy') }}</span>
          </a-menu-item>
          <a-menu-divider />
          <a-menu-item key="delete" danger>
            <span>{{ t('workflowEditor.nodeAction.delete') }}</span>
            <span class="workflow-graph-node__shortcut">{{ t('workflowEditor.nodeAction.shortcutDel') }}</span>
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>

    <Handle
      v-if="data.kind !== 'start'"
      type="target"
      :position="Position.Left"
      class="workflow-graph-node__handle workflow-graph-node__handle--target"
    />
    <div class="workflow-graph-node__body">
      <div class="workflow-graph-node__icon-wrap" aria-hidden="true">
        <component :is="nodeIcon" class="workflow-graph-node__icon" />
      </div>
      <div class="workflow-graph-node__content">
        <div class="workflow-graph-node__header">
          <span class="workflow-graph-node__badge">{{ kindLabel }}</span>
        </div>
        <div class="workflow-graph-node__title">{{ title }}</div>
      </div>
    </div>
    <Handle
      v-if="data.kind !== 'end'"
      type="source"
      :position="Position.Right"
      class="workflow-graph-node__handle workflow-graph-node__handle--source"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position, useVueFlow } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import { EllipsisOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { MenuProps } from 'ant-design-vue';
import {
  createUniqueWorkflowNodeId,
  type WorkflowFlowNodeData,
} from '@/utils/workflow-graph-flow';
import { isWorkflowNodeDeletable } from '@/utils/workflow-graph-node-actions';
import { resolveWorkflowGraphNodeIcon } from '@/utils/workflow-palette-icons';

const props = defineProps<NodeProps<WorkflowFlowNodeData>>();

const { t } = useI18n();
const { removeNodes, findNode, addNodes, getNodes, updateNode } = useVueFlow();

const data = computed(() => props.data ?? { kind: 'tool' as const });

/** 当前节点是否展示删除/复制菜单 */
const deletable = computed(() => isWorkflowNodeDeletable(data.value.kind));

/**
 * 节点类型徽章文案。
 */
const kindLabel = computed(() => t(`workflowEditor.kind.${data.value.kind}`));

/**
 * 节点主标题（Tool 走 agent.status，其余走 labelKey）。
 */
const title = computed(() => {
  if (data.value.toolName) {
    const key = `agent.status.${data.value.toolName}`;
    const translated = t(key);
    return translated !== key ? translated : data.value.toolName;
  }
  if (data.value.labelKey) {
    return t(data.value.labelKey);
  }
  return props.id;
});

/**
 * 画布节点图标（与左侧面板一致）。
 */
const nodeIcon = computed(() =>
  resolveWorkflowGraphNodeIcon({
    kind: data.value.kind,
    nodeId: props.id,
    toolName: data.value.toolName,
  }),
);

/**
 * 复制当前节点（偏移位置，避免与原节点重叠）。
 */
function duplicateCurrentNode(): void {
  const source = findNode(props.id);
  if (!source) return;

  const existingIds = new Set(getNodes.value.map((node) => node.id));
  const nextId = createUniqueWorkflowNodeId(`${source.id}_copy`, existingIds);

  updateNode(props.id, (node) => ({ ...node, selected: false }));
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
  updateNode(nextId, (node) => ({ ...node, selected: true }));
}

/**
 * 删除当前节点及其关联边。
 */
function deleteCurrentNode(): void {
  removeNodes([props.id]);
}

/**
 * 节点菜单点击：复制或删除。
 *
 * @param info - Ant Design Menu 点击事件
 */
function onMenuClick(info: Parameters<NonNullable<MenuProps['onClick']>>[0]): void {
  if (info.key === 'copy') {
    duplicateCurrentNode();
    return;
  }
  if (info.key === 'delete') {
    deleteCurrentNode();
  }
}
</script>

<style scoped>
.workflow-graph-node {
  position: relative;
  min-width: 168px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 2px solid #d9d9d9;
  background: #fff;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
  font-size: 12px;
}

.workflow-graph-node--selected {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgb(22 119 255 / 20%);
}

.workflow-graph-node--start {
  border-color: #52c41a;
  background: #f6ffed;
}

.workflow-graph-node--end {
  border-color: #ff4d4f;
  background: #fff2f0;
}

.workflow-graph-node--condition {
  border-color: #faad14;
  background: #fffbe6;
}

.workflow-graph-node--subgraph,
.workflow-graph-node--branch {
  border-color: #722ed1;
  background: #f9f0ff;
}

.workflow-graph-node--tool {
  border-color: #1677ff;
  background: #e6f4ff;
}

.workflow-graph-node__menu-trigger {
  position: absolute;
  top: -12px;
  left: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  color: #595959;
  cursor: pointer;
  transform: translateX(-50%);
  box-shadow: 0 1px 4px rgb(0 0 0 / 8%);
}

.workflow-graph-node__menu-trigger:hover {
  color: #1677ff;
  border-color: #1677ff;
}

.workflow-graph-node__body {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.workflow-graph-node__icon-wrap {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-top: 2px;
  border-radius: 8px;
  background: rgb(255 255 255 / 72%);
}

.workflow-graph-node__icon {
  font-size: 16px;
  line-height: 1;
}

.workflow-graph-node--start .workflow-graph-node__icon-wrap {
  color: #389e0d;
}

.workflow-graph-node--end .workflow-graph-node__icon-wrap {
  color: #cf1322;
}

.workflow-graph-node--condition .workflow-graph-node__icon-wrap {
  color: #d48806;
}

.workflow-graph-node--subgraph .workflow-graph-node__icon-wrap,
.workflow-graph-node--branch .workflow-graph-node__icon-wrap {
  color: #531dab;
}

.workflow-graph-node--tool .workflow-graph-node__icon-wrap {
  color: #0958d9;
}

.workflow-graph-node__content {
  flex: 1;
  min-width: 0;
}

.workflow-graph-node__header {
  margin-bottom: 4px;
}

.workflow-graph-node__badge {
  display: inline-block;
  padding: 0 6px;
  border-radius: 4px;
  background: rgb(0 0 0 / 6%);
  color: #595959;
  font-size: 11px;
}

.workflow-graph-node__title {
  font-weight: 600;
  color: #262626;
  line-height: 1.4;
  word-break: break-word;
}

.workflow-graph-node__shortcut {
  float: right;
  margin-left: 24px;
  color: #8c8c8c;
  font-size: 12px;
}

.workflow-graph-node :deep(.workflow-graph-node__handle) {
  width: 12px;
  height: 12px;
  border: 2px solid #1677ff;
  background: #fff;
  z-index: 3;
}

.workflow-graph-node :deep(.workflow-graph-node__handle--target) {
  left: -7px;
}

.workflow-graph-node :deep(.workflow-graph-node__handle--source) {
  right: -7px;
}
</style>
