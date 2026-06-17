<template>
  <view v-if="steps.length > 0" class="agent-tool-list">
    <text class="agent-tool-title">{{ t('agent.status.progressTitle') }}</text>
    <view
      v-for="(step, index) in steps"
      :key="`${step.tool}-${index}`"
      class="agent-tool-item"
    >
      <text class="agent-tool-icon" :class="statusClass(step.status)">{{ statusIcon(step.status) }}</text>
      <text class="agent-tool-label">{{ labelFor(step.tool) }}</text>
      <text v-if="step.ms != null && step.ms > 0" class="agent-tool-ms">{{ step.ms }}ms</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { AgentToolStepView } from '@douxing/shared';
import { useTf } from '@/i18n/useTf';

defineProps<{
  steps: AgentToolStepView[];
}>();

const { t } = useTf();

function labelFor(tool: string): string {
  const key = `agent.status.${tool}`;
  const translated = t(key);
  return translated === key ? t('agent.status.unknown') : translated;
}

function statusIcon(status: AgentToolStepView['status']): string {
  if (status === 'done') return '✓';
  if (status === 'failed') return '!';
  if (status === 'running') return '…';
  return '·';
}

function statusClass(status: AgentToolStepView['status']): string {
  if (status === 'done') return 'is-done';
  if (status === 'failed') return 'is-failed';
  if (status === 'running') return 'is-running';
  return 'is-pending';
}
</script>

<style scoped>
.agent-tool-list {
  margin-top: 24rpx;
  width: 100%;
}

.agent-tool-title {
  display: block;
  margin-bottom: 12rpx;
  font-size: 22rpx;
  color: var(--dx-text-muted);
  text-align: center;
}

.agent-tool-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
  padding: 12rpx 16rpx;
  border-radius: var(--dx-radius-sm);
  background: var(--dx-surface-muted, #f8fafc);
}

.agent-tool-icon {
  width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  border-radius: 50%;
  font-size: 22rpx;
  flex-shrink: 0;
}

.agent-tool-icon.is-done {
  background: #d1fae5;
  color: #047857;
}

.agent-tool-icon.is-failed {
  background: #fee2e2;
  color: #b91c1c;
}

.agent-tool-icon.is-running {
  background: #e0f2fe;
  color: #0369a1;
}

.agent-tool-icon.is-pending {
  background: #e2e8f0;
  color: #475569;
}

.agent-tool-label {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  color: var(--dx-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-tool-ms {
  flex-shrink: 0;
  font-size: 20rpx;
  color: var(--dx-text-muted);
}
</style>
