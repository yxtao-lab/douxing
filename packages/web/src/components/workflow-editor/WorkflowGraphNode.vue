<template>
  <div
    class="workflow-graph-node"
    :class="[
      `workflow-graph-node--${data.kind}`,
      { 'workflow-graph-node--selected': props.selected },
      executionClass,
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
      <div v-if="data.kind !== 'start'" class="workflow-graph-node__icon-wrap" aria-hidden="true">
        <component :is="nodeIcon" class="workflow-graph-node__icon" />
      </div>
      <div class="workflow-graph-node__content">
        <div class="workflow-graph-node__header">
          <span class="workflow-graph-node__badge">{{ kindLabel }}</span>
        </div>
        <div v-if="data.kind !== 'start'" class="workflow-graph-node__title">{{ title }}</div>
        <div
          v-if="data.kind === 'condition' && data.routedIntent"
          class="workflow-graph-node__route-badge"
        >
          {{ t('workflowEditor.execution.routedIntent', { intent: routedIntentLabel }) }}
        </div>
        <div
          v-if="data.kind === 'branch' && data.isTakenBranch"
          class="workflow-graph-node__branch-hit"
        >
          {{ t('workflowEditor.execution.branchTaken') }}
        </div>
        <div
          v-if="data.kind === 'branch' && data.routedIntent && !data.isTakenBranch && branchSkipped"
          class="workflow-graph-node__branch-skip"
        >
          {{ t('workflowEditor.execution.branchSkipped') }}
        </div>
        <div
          v-if="data.kind === 'start' && sandboxCtx"
          class="workflow-graph-node__start-form"
          @click.stop
          @mousedown.stop
          @pointerdown.stop
        >
          <a-textarea
            :value="sandboxCtx.prompt.value"
            :rows="2"
            :maxlength="500"
            :placeholder="t('workflowEditor.startNode.promptPlaceholder')"
            :disabled="sandboxCtx.running.value"
            class="workflow-graph-node__start-input"
            @update:value="sandboxCtx.setPrompt"
          />
          <a-button
            type="primary"
            size="small"
            block
            :loading="sandboxCtx.running.value"
            :disabled="!sandboxCtx.prompt.value.trim()"
            @click="sandboxCtx.run"
          >
            {{ t('workflowEditor.startNode.run') }}
          </a-button>
          <p class="workflow-graph-node__start-hint">{{ t('workflowEditor.startNode.draftHint') }}</p>
        </div>
        <div
          v-if="executionStatus && executionStatus !== 'pending'"
          class="workflow-graph-node__exec-badge"
          :class="`workflow-graph-node__exec-badge--${executionStatus}`"
        >
          {{ executionStatusLabel }}
        </div>
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
import { computed, inject } from 'vue';
import { Handle, Position, useVueFlow } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import { EllipsisOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { MenuProps } from 'ant-design-vue';
import type { WorkflowNodeExecutionStatus } from '@douxing/shared';
import {
  createUniqueWorkflowNodeId,
  type WorkflowFlowNodeData,
} from '@/utils/workflow-graph-flow';
import { isWorkflowNodeDeletable } from '@/utils/workflow-graph-node-actions';
import { resolveWorkflowGraphNodeIcon } from '@/utils/workflow-palette-icons';
import {
  WORKFLOW_SANDBOX_INJECT_KEY,
  type WorkflowSandboxInjectContext,
} from '@/utils/workflow-sandbox-inject';

const props = defineProps<NodeProps<WorkflowFlowNodeData>>();

const { t } = useI18n();
const { removeNodes, findNode, addNodes, getNodes, updateNode } = useVueFlow();

const data = computed(() => props.data ?? { kind: 'tool' as const });

/** 沙箱运行上下文（开始节点输入用） */
const sandboxCtx = inject(WORKFLOW_SANDBOX_INJECT_KEY, null) as WorkflowSandboxInjectContext | null;

/** 沙箱执行状态（来自画布 execution 快照） */
const executionStatus = computed((): WorkflowNodeExecutionStatus | undefined =>
  data.value.executionStatus,
);

/**
 * 路由意图展示名（条件节点）。
 */
const routedIntentLabel = computed(() => {
  const intent = data.value.routedIntent;
  if (!intent) return '';
  const key = `workflowEditor.execution.route.${intent}`;
  const translated = t(key);
  return translated !== key ? translated : intent;
});

/** 分支节点是否被跳过（已有 routedIntent 且非命中） */
const branchSkipped = computed(
  () =>
    data.value.kind === 'branch'
    && !!data.value.routedIntent
    && !data.value.isTakenBranch
    && (executionStatus.value === 'pending' || executionStatus.value === undefined),
);

/**
 * 执行状态 CSS 类名。
 */
const executionClass = computed(() => {
  const status = executionStatus.value;
  if (!status || status === 'pending') return null;
  return `workflow-graph-node--exec-${status}`;
});

/**
 * 执行状态徽章文案。
 */
const executionStatusLabel = computed(() => {
  const status = executionStatus.value ?? 'pending';
  return t(`workflowEditor.execution.status.${status}`);
});

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
  min-width: 220px;
}

.workflow-graph-node__start-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.workflow-graph-node__start-input {
  font-size: 12px;
}

.workflow-graph-node__start-hint {
  margin: 0;
  color: #8c8c8c;
  font-size: 10px;
  line-height: 1.4;
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

.workflow-graph-node--branch {
  border-color: #722ed1;
  background: #f9f0ff;
}

.workflow-graph-node--branch.workflow-graph-node--exec-success,
.workflow-graph-node--branch:has(.workflow-graph-node__branch-hit) {
  border-color: #52c41a;
  background: #f6ffed;
}

.workflow-graph-node__route-badge {
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  color: #d48806;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
}

.workflow-graph-node__branch-hit {
  margin-top: 6px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f6ffed;
  color: #389e0d;
  font-size: 10px;
  font-weight: 600;
}

.workflow-graph-node__branch-skip {
  margin-top: 6px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #fafafa;
  color: #bfbfbf;
  font-size: 10px;
  text-decoration: line-through;
}

.workflow-graph-node--exec-running {
  border-color: #1677ff;
  box-shadow: 0 0 0 3px rgb(22 119 255 / 25%);
  animation: workflow-node-pulse 1.2s ease-in-out infinite;
}

.workflow-graph-node--exec-success {
  border-color: #52c41a;
  box-shadow: 0 0 0 2px rgb(82 196 26 / 20%);
}

.workflow-graph-node--exec-failed {
  border-color: #ff4d4f;
  box-shadow: 0 0 0 2px rgb(255 77 79 / 20%);
}

.workflow-graph-node__exec-badge {
  margin-top: 6px;
  display: inline-block;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.workflow-graph-node__exec-badge--running {
  background: #e6f4ff;
  color: #0958d9;
}

.workflow-graph-node__exec-badge--success {
  background: #f6ffed;
  color: #389e0d;
}

.workflow-graph-node__exec-badge--failed {
  background: #fff2f0;
  color: #cf1322;
}

@keyframes workflow-node-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 2px rgb(22 119 255 / 15%);
  }

  50% {
    box-shadow: 0 0 0 5px rgb(22 119 255 / 28%);
  }
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
