<template>
  <div
    class="workflow-graph-node"
    :class="[`workflow-graph-node--${data.kind}`, { 'workflow-graph-node--selected': props.selected }]"
  >
    <Handle v-if="data.kind !== 'start'" type="target" :position="Position.Left" />
    <div class="workflow-graph-node__header">
      <span class="workflow-graph-node__badge">{{ kindLabel }}</span>
    </div>
    <div class="workflow-graph-node__title">{{ title }}</div>
    <Handle v-if="data.kind !== 'end'" type="source" :position="Position.Right" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import { useI18n } from 'vue-i18n';
import type { WorkflowFlowNodeData } from '@/utils/workflow-graph-flow';

const props = defineProps<NodeProps<WorkflowFlowNodeData>>();

const { t } = useI18n();

const data = computed(() => props.data ?? { kind: 'tool' as const });

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
</script>

<style scoped>
.workflow-graph-node {
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
</style>
