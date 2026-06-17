<template>
  <div v-if="steps.length > 0" class="mt-4 w-full">
    <p class="mb-2 text-center text-xs font-medium text-dx-muted">
      {{ t('agent.status.progressTitle') }}
    </p>
    <ul class="space-y-1.5 text-left" role="list">
      <li
        v-for="(step, index) in steps"
        :key="`${step.tool}-${index}`"
        class="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
      >
        <span
          class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs"
          :class="statusClass(step.status)"
          aria-hidden="true"
        >
          {{ statusIcon(step.status) }}
        </span>
        <span class="min-w-0 flex-1 truncate text-dx-text">{{ labelFor(step.tool) }}</span>
        <span v-if="step.ms != null && step.ms > 0" class="shrink-0 text-xs text-dx-muted">
          {{ step.ms }}ms
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { AgentToolStepView } from '@douxing/shared';
import { useLocale } from '@/i18n/useLocale';

defineProps<{
  steps: AgentToolStepView[];
}>();

const { t } = useLocale();

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
  if (status === 'done') return 'bg-emerald-100 text-emerald-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  if (status === 'running') return 'bg-sky-100 text-sky-700';
  return 'bg-slate-200 text-slate-600';
}
</script>
