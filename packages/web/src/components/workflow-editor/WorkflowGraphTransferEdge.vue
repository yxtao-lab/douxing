<template>
  <BaseEdge :id="id" :path="path" :marker-end="markerEnd" :style="edgeStyle" :class="edgeClass" />
  <EdgeLabelRenderer>
    <div
      v-if="labelContent"
      class="workflow-transfer-edge__label"
      :class="labelClass"
      :style="labelPosition"
    >
      <a-popover
        v-if="transferJson"
        trigger="click"
        placement="top"
        overlay-class-name="workflow-transfer-edge__popover"
      >
        <template #content>
          <div class="workflow-transfer-edge__json-header">
            {{ t('workflowEditor.execution.edgeJsonTitle') }}
          </div>
          <pre class="workflow-transfer-edge__json">{{ transferJson }}</pre>
        </template>
        <button type="button" class="workflow-transfer-edge__chip" @click.stop>
          <span v-if="branchState === 'taken'" class="workflow-transfer-edge__icon">✓</span>
          <span v-else-if="branchState === 'skipped'" class="workflow-transfer-edge__icon">×</span>
          {{ labelContent }}
        </button>
      </a-popover>
      <span v-else class="workflow-transfer-edge__chip workflow-transfer-edge__chip--static">
        <span v-if="branchState === 'taken'" class="workflow-transfer-edge__icon">✓</span>
        <span v-else-if="branchState === 'skipped'" class="workflow-transfer-edge__icon">×</span>
        {{ labelContent }}
      </span>
    </div>
  </EdgeLabelRenderer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@vue-flow/core';
import { useI18n } from 'vue-i18n';

/** 边上 data 载荷 */
export interface WorkflowTransferEdgeData {
  transferPreview?: string;
  transferJson?: string;
  branchState?: 'taken' | 'skipped' | 'none';
  executionMode?: 'flowing' | 'active' | 'idle';
  staticLabel?: string;
}

const props = defineProps<EdgeProps<WorkflowTransferEdgeData>>();

const { t } = useI18n();

/**
 * 贝塞尔路径与标签坐标。
 */
const pathInfo = computed(() =>
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  }),
);

const path = computed(() => pathInfo.value[0]);
const labelPosition = computed(() => ({
  position: 'absolute' as const,
  transform: `translate(-50%, -50%) translate(${pathInfo.value[1]}px, ${pathInfo.value[2]}px)`,
  pointerEvents: 'all' as const,
}));

const edgeData = computed(() => (props.data ?? {}) as WorkflowTransferEdgeData);

const branchState = computed(() => edgeData.value.branchState ?? 'none');

const executionMode = computed(() => edgeData.value.executionMode ?? 'idle');

const transferJson = computed(() => edgeData.value.transferJson?.trim() || '');

/**
 * 边上展示文案：优先 transfer 摘要，其次静态条件 label。
 */
const labelContent = computed(() => {
  if (edgeData.value.transferPreview?.trim()) return edgeData.value.transferPreview;
  if (branchState.value !== 'none' && edgeData.value.staticLabel?.trim()) {
    return edgeData.value.staticLabel;
  }
  if (transferJson.value) return edgeData.value.transferPreview;
  return edgeData.value.staticLabel?.trim() || '';
});

/**
 * 边 stroke 样式。
 */
const edgeStyle = computed(() => {
  if (branchState.value === 'taken') {
    return { stroke: '#52c41a', strokeWidth: 3 };
  }
  if (branchState.value === 'skipped') {
    return { stroke: '#bfbfbf', strokeWidth: 1.5, strokeDasharray: '6 4', opacity: 0.55 };
  }
  if (executionMode.value === 'flowing') {
    return { stroke: '#1677ff', strokeWidth: 3 };
  }
  if (executionMode.value === 'active') {
    return { stroke: '#52c41a', strokeWidth: 2.5 };
  }
  return undefined;
});

const edgeClass = computed(() => {
  if (executionMode.value === 'flowing') return 'workflow-transfer-edge--flowing';
  if (branchState.value === 'skipped') return 'workflow-transfer-edge--skipped';
  return undefined;
});

const labelClass = computed(() => ({
  'workflow-transfer-edge__label--taken': branchState.value === 'taken',
  'workflow-transfer-edge__label--skipped': branchState.value === 'skipped',
  'workflow-transfer-edge__label--flowing': executionMode.value === 'flowing',
}));
</script>

<style scoped>
.workflow-transfer-edge__label {
  z-index: 4;
}

.workflow-transfer-edge__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 200px;
  padding: 2px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  color: #595959;
  font-size: 10px;
  line-height: 1.4;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workflow-transfer-edge__chip--static {
  cursor: default;
}

.workflow-transfer-edge__label--taken .workflow-transfer-edge__chip {
  border-color: #b7eb8f;
  background: #f6ffed;
  color: #389e0d;
}

.workflow-transfer-edge__label--skipped .workflow-transfer-edge__chip {
  border-color: #f0f0f0;
  background: #fafafa;
  color: #bfbfbf;
  text-decoration: line-through;
}

.workflow-transfer-edge__label--flowing .workflow-transfer-edge__chip {
  border-color: #91caff;
  background: #e6f4ff;
  color: #0958d9;
}

.workflow-transfer-edge__icon {
  flex-shrink: 0;
  font-weight: 700;
}

.workflow-transfer-edge__json-header {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #262626;
}

.workflow-transfer-edge__json {
  margin: 0;
  max-width: 420px;
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 11px;
  line-height: 1.5;
  color: #595959;
}
</style>

<style>
.workflow-transfer-edge--flowing path {
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
