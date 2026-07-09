<template>
  <div class="workflow-graph-execution-panel">
    <a-empty v-if="!execution" :description="t('workflowEditor.execution.empty')" />
    <template v-else>
      <div class="workflow-graph-execution-panel__summary">
        <a-tag v-if="execution.runningTool" color="processing">
          {{ t('workflowEditor.execution.running', { tool: runningToolLabel }) }}
        </a-tag>
        <a-tag v-else-if="execution.completed && !execution.failed" color="success">
          {{ t('workflowEditor.execution.completed') }}
        </a-tag>
        <a-tag v-else-if="execution.failed" color="error">
          {{ t('workflowEditor.execution.failed') }}
        </a-tag>
        <a-tag v-else color="default">
          {{ t('workflowEditor.execution.preparing') }}
        </a-tag>
      </div>

      <a-divider style="margin: 12px 0" />

      <div
        v-if="flowingEdgeItems.length"
        class="workflow-graph-execution-panel__flowing"
      >
        <div class="workflow-graph-execution-panel__flowing-title">
          {{ t('workflowEditor.execution.flowingTitle') }}
        </div>
        <div
          v-for="item in flowingEdgeItems"
          :key="item.edgeId"
          class="workflow-graph-execution-panel__flow-item"
        >
          <a-popover trigger="click" placement="left">
            <template #content>
              <div class="workflow-graph-execution-panel__json-header">
                {{ t('workflowEditor.execution.edgeJsonTitle') }}
              </div>
              <pre class="workflow-graph-execution-panel__digest workflow-graph-execution-panel__digest--full">{{ item.json }}</pre>
            </template>
            <a-tag color="processing" class="workflow-graph-execution-panel__flow-tag">
              {{ item.preview || item.edgeId }}
            </a-tag>
          </a-popover>
        </div>
      </div>

      <div
        v-if="execution?.routedIntent"
        class="workflow-graph-execution-panel__branch"
      >
        <div class="workflow-graph-execution-panel__flowing-title">
          {{ t('workflowEditor.execution.branchTitle') }}
        </div>
        <a-descriptions size="small" :column="1" bordered>
          <a-descriptions-item :label="t('workflowEditor.execution.routedIntentLabel')">
            {{ routedIntentLabel }}
          </a-descriptions-item>
          <a-descriptions-item
            v-if="takenBranchLabel"
            :label="t('workflowEditor.execution.takenBranchLabel')"
          >
            <a-tag color="success">{{ takenBranchLabel }}</a-tag>
          </a-descriptions-item>
        </a-descriptions>
      </div>

      <a-divider
        v-if="flowingEdgeItems.length || execution?.routedIntent"
        style="margin: 12px 0"
      />

      <a-empty
        v-if="!selectedNodeId"
        :description="t('workflowEditor.execution.selectNodeHint')"
      />
      <template v-else>
        <div class="workflow-graph-execution-panel__node-title">
          {{ selectedNodeTitle }}
        </div>
        <a-descriptions size="small" :column="1" bordered>
          <a-descriptions-item :label="t('workflowEditor.execution.statusLabel')">
            <a-tag :color="statusTagColor">{{ statusLabel }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item
            v-if="selectedState?.ms != null"
            :label="t('workflowEditor.execution.durationLabel')"
          >
            {{ selectedState.ms }} ms
          </a-descriptions-item>
          <a-descriptions-item
            v-if="selectedState?.span?.inputDigest"
            :label="t('workflowEditor.execution.inputDigest')"
          >
            <pre class="workflow-graph-execution-panel__digest">{{ selectedState.span.inputDigest }}</pre>
          </a-descriptions-item>
          <a-descriptions-item
            v-if="selectedOutputDigest"
            :label="outputDigestLabel"
          >
            <pre class="workflow-graph-execution-panel__digest">{{ formattedOutputDigest }}</pre>
          </a-descriptions-item>
        </a-descriptions>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  formatWorkflowTransferJson,
  type WorkflowGraphExecutionSnapshot,
  type WorkflowNodeExecutionState,
} from '@douxing/shared';

const props = defineProps<{
  execution: WorkflowGraphExecutionSnapshot | null;
  selectedNodeId: string | null;
  selectedToolName?: string;
  selectedLabelKey?: string;
  graphNodeLabelKeyById?: Record<string, string>;
}>();

const { t } = useI18n();

/**
 * 正在流动的边及 JSON 载荷列表。
 */
const flowingEdgeItems = computed(() => {
  if (!props.execution?.flowingEdgeIds?.length) return [];
  return props.execution.flowingEdgeIds.map((edgeId) => ({
    edgeId,
    preview: props.execution?.edgeTransfers[edgeId] ?? '',
    json: props.execution?.edgeTransferPayloads[edgeId] ?? props.execution?.edgeTransfers[edgeId] ?? '',
  }));
});

/**
 * 路由意图展示名。
 */
const routedIntentLabel = computed(() => {
  const intent = props.execution?.routedIntent;
  if (!intent) return '';
  const key = `workflowEditor.execution.route.${intent}`;
  const translated = t(key);
  return translated !== key ? translated : intent;
});

/**
 * 命中分支展示名。
 */
const takenBranchLabel = computed(() => {
  const nodeId = props.execution?.takenBranchNodeId;
  if (!nodeId) return '';
  const labelKey = props.graphNodeLabelKeyById?.[nodeId];
  if (labelKey) return t(labelKey);
  return nodeId;
});

/**
 * 当前选中节点的执行状态。
 */
const selectedState = computed((): WorkflowNodeExecutionState | null => {
  if (!props.execution || !props.selectedNodeId) return null;
  return props.execution.nodeStates[props.selectedNodeId] ?? null;
});

/**
 * 选中节点标题。
 */
const selectedNodeTitle = computed(() => {
  if (props.selectedToolName) {
    const key = `agent.status.${props.selectedToolName}`;
    const translated = t(key);
    return translated !== key ? translated : props.selectedToolName;
  }
  if (props.selectedLabelKey) return t(props.selectedLabelKey);
  return props.selectedNodeId ?? '';
});

/**
 * 正在运行的 tool 展示名。
 */
const runningToolLabel = computed(() => {
  const tool = props.execution?.runningTool;
  if (!tool) return '';
  const key = `agent.status.${tool}`;
  const translated = t(key);
  return translated !== key ? translated : tool;
});

/**
 * 状态 Tag 颜色。
 */
const statusTagColor = computed(() => {
  const status = selectedState.value?.status;
  if (status === 'running') return 'processing';
  if (status === 'success') return 'success';
  if (status === 'failed') return 'error';
  return 'default';
});

/**
 * 状态文案。
 */
const statusLabel = computed(() => {
  const status = selectedState.value?.status ?? 'pending';
  return t(`workflowEditor.execution.status.${status}`);
});

/**
 * 选中节点的输出摘要（Tool span 或编排节点 outputDigest）。
 */
const selectedOutputDigest = computed(() =>
  selectedState.value?.outputDigest ?? selectedState.value?.span?.outputDigest ?? '',
);

/**
 * 输出区标题：结束节点展示规划结果，其余为输出摘要。
 */
const outputDigestLabel = computed(() =>
  props.selectedNodeId === 'end'
    ? t('workflowEditor.execution.planResult')
    : t('workflowEditor.execution.outputDigest'),
);

/**
 * 格式化后的输出 JSON。
 */
const formattedOutputDigest = computed(() =>
  formatWorkflowTransferJson(selectedOutputDigest.value),
);
</script>

<style scoped>
.workflow-graph-execution-panel__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.workflow-graph-execution-panel__flowing-title {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #595959;
}

.workflow-graph-execution-panel__flowing {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.workflow-graph-execution-panel__flow-item {
  display: inline-flex;
}

.workflow-graph-execution-panel__flow-tag {
  cursor: pointer;
}

.workflow-graph-execution-panel__branch {
  margin-bottom: 4px;
}

.workflow-graph-execution-panel__json-header {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
}

.workflow-graph-execution-panel__digest--full {
  max-height: 320px;
  max-width: 420px;
}

.workflow-graph-execution-panel__node-title {
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 13px;
  color: #262626;
}

.workflow-graph-execution-panel__digest {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 11px;
  line-height: 1.5;
  color: #595959;
  max-height: 160px;
  overflow: auto;
}
</style>
