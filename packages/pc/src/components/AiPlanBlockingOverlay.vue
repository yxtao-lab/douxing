<template>
  <Teleport to="body">
    <div
      v-if="aiPlanning"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/55 p-6"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      @click.stop
    >
      <div
        class="w-full max-w-md rounded-2xl border border-dx-border bg-white p-8 shadow-xl"
        @click.stop
      >
        <div
          class="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-dx-border border-t-dx-primary"
          aria-hidden="true"
        />
        <p class="mt-6 text-center text-base font-semibold text-dx-text">
          {{ aiPlanMessage || t('plan.aiPlanning') }}
        </p>
        <AgentToolStatusList :steps="aiPlanToolSteps" />
        <p class="mt-2 text-center text-sm text-dx-muted">{{ t('plan.aiPlanningHint') }}</p>
        <p class="mt-1 text-center text-xs text-dx-muted">{{ t('plan.aiPlanningTip') }}</p>
        <button
          type="button"
          class="dx-btn-secondary mt-6 w-full"
          @click="handleCancel"
        >
          {{ t('plan.aiPlanningCancel') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { aiPlanLoading, aiPlanMessage, aiPlanToolSteps, cancelAiPlanRequest } from '@/api/ai-plan';
import AgentToolStatusList from '@/components/AgentToolStatusList.vue';
import { useLocale } from '@/i18n/useLocale';
import { appMessage } from '@/composables/useAppMessage';

const { t } = useLocale();
const aiPlanning = aiPlanLoading;

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!aiPlanning.value) return;
  event.preventDefault();
  event.returnValue = '';
}

function syncBeforeUnloadListener(active: boolean) {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  if (active) {
    window.addEventListener('beforeunload', handleBeforeUnload);
  }
}

watch(
  aiPlanning,
  (active) => {
    syncBeforeUnloadListener(active);
    if (active) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  },
  { immediate: true },
);

onBeforeRouteLeave((_to, _from, next) => {
  if (!aiPlanning.value) {
    next();
    return;
  }
  const confirmed = window.confirm(t('plan.aiPlanningLeaveConfirm'));
  if (!confirmed) {
    next(false);
    return;
  }
  cancelAiPlanRequest();
  next();
});

function handleCancel() {
  cancelAiPlanRequest();
  appMessage.info(t('plan.cancelled'), 2800);
}

onBeforeUnmount(() => {
  syncBeforeUnloadListener(false);
  document.body.style.overflow = '';
});
</script>
