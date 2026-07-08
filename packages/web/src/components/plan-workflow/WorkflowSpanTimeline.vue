<template>
  <div class="workflow-span-timeline">
    <div
      v-for="span in spans"
      :key="span.nodeId ?? `${span.tool}-${span.ms}`"
      class="timeline-row"
    >
      <div class="timeline-meta">
        <div class="timeline-title">
          <a-tag :color="span.ok ? 'success' : 'error'">{{ span.tool }}</a-tag>
          <span class="node-id">{{ span.nodeId ?? span.tool }}</span>
          <span class="duration">{{ span.ms }} {{ t('planDiagnostics.msUnit') }}</span>
          <span v-if="span.estimatedCostCny != null" class="cost">
            ¥{{ span.estimatedCostCny.toFixed(6) }}
          </span>
        </div>
        <div class="timeline-bar-track">
          <div
            class="timeline-bar-fill"
            :class="{ 'timeline-bar-fill--error': !span.ok }"
            :style="{ width: barWidth(span.ms) }"
          />
        </div>
      </div>

      <a-collapse v-if="hasDetails(span)" ghost>
        <a-collapse-panel :key="span.nodeId ?? span.tool" :header="t('planDiagnostics.expandDetails')">
          <a-descriptions :column="1" size="small" bordered>
            <a-descriptions-item v-if="span.inputDigest" :label="t('planDiagnostics.inputDigest')">
              {{ span.inputDigest }}
            </a-descriptions-item>
            <a-descriptions-item v-if="span.outputDigest" :label="t('planDiagnostics.outputDigest')">
              {{ span.outputDigest }}
            </a-descriptions-item>
            <a-descriptions-item
              v-if="span.ragMatchedIds?.length"
              :label="t('planDiagnostics.ragMatchedIds')"
            >
              {{ span.ragMatchedIds.join(', ') }}
            </a-descriptions-item>
            <a-descriptions-item
              v-if="span.ragScoreSummary?.length"
              :label="t('planDiagnostics.ragScoreSummary')"
            >
              <span
                v-for="item in span.ragScoreSummary.slice(0, 8)"
                :key="item.id"
                class="rag-chip"
              >
                #{{ item.id }} ({{ item.score.toFixed(2) }}{{ item.name ? `: ${item.name}` : '' }})
              </span>
            </a-descriptions-item>
            <a-descriptions-item
              v-if="span.matchedPlaybookIds?.length"
              :label="t('planDiagnostics.matchedPlaybooks')"
            >
              {{ span.matchedPlaybookIds.join(', ') }}
            </a-descriptions-item>
            <a-descriptions-item v-if="span.llmUsage" :label="t('planDiagnostics.llmUsage')">
              {{ span.llmUsage.model }} · in {{ span.llmUsage.inputTokens }} / out
              {{ span.llmUsage.outputTokens }}
            </a-descriptions-item>
            <a-descriptions-item
              v-if="span.externalApiCalls"
              :label="t('planDiagnostics.externalApiCalls')"
            >
              {{ span.externalApiCalls }}
            </a-descriptions-item>
            <a-descriptions-item v-if="span.errorCode" :label="t('planDiagnostics.errorCode')">
              {{ span.errorCode }}
            </a-descriptions-item>
          </a-descriptions>
        </a-collapse-panel>
      </a-collapse>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AgentToolTraceEntry } from '@douxing/shared';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  spans: AgentToolTraceEntry[];
  totalDurationMs: number;
}>();

const { t } = useI18n();

/**
 * 计算 Gantt 式进度条宽度百分比。
 *
 * @param ms - 节点耗时毫秒
 * @returns CSS width 百分比字符串
 */
function barWidth(ms: number): string {
  const total = Math.max(props.totalDurationMs, 1);
  const pct = Math.max(4, Math.round((ms / total) * 100));
  return `${Math.min(pct, 100)}%`;
}

/**
 * 判断节点是否有可展开的 RAG/LLM 摘要详情。
 *
 * @param span - NodeSpan 条目
 * @returns 存在 digest/RAG/LLM 等字段时为 true
 */
function hasDetails(span: AgentToolTraceEntry): boolean {
  return Boolean(
    span.inputDigest
    || span.outputDigest
    || span.ragMatchedIds?.length
    || span.ragScoreSummary?.length
    || span.matchedPlaybookIds?.length
    || span.llmUsage
    || span.externalApiCalls
    || span.errorCode,
  );
}
</script>

<style scoped>
.workflow-span-timeline {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.timeline-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding-bottom: 12px;
}

.timeline-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.node-id {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
}

.duration,
.cost {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.timeline-bar-track {
  height: 8px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  overflow: hidden;
}

.timeline-bar-fill {
  height: 100%;
  background: #1677ff;
  border-radius: 4px;
  min-width: 4%;
}

.timeline-bar-fill--error {
  background: #ff4d4f;
}

.rag-chip {
  display: inline-block;
  margin-right: 8px;
  font-size: 12px;
}
</style>
