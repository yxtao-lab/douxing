<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[1200] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      @click="handleClose"
    >
      <div
        class="flex max-h-[85vh] w-full max-w-lg flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl"
        @click.stop
      >
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-dx-text">{{ t('routes.missedSheetTitle') }}</h2>
          <button type="button" class="text-2xl leading-none text-dx-muted" @click="handleClose">×</button>
        </div>

        <p class="text-sm text-dx-muted">{{ t('routes.missedSheetHint') }}</p>

        <div v-if="loading" class="py-6 text-sm text-dx-muted">{{ t('routes.missedLoading') }}</div>

        <div v-else-if="errorText" class="py-4 text-sm text-red-600">{{ errorText }}</div>

        <div v-else class="min-h-0 flex-1 overflow-y-auto space-y-4">
          <p v-if="analysis && analysis.missed.length === 0" class="text-sm text-dx-muted">
            {{ t('routes.missedEmpty') }}
          </p>

          <template v-else-if="analysis">
            <div>
              <h3 class="mb-2 text-sm font-semibold text-dx-text">{{ t('routes.missedListTitle') }}</h3>
              <ul class="space-y-2">
                <li
                  v-for="(item, index) in analysis.missed"
                  :key="`${item.name}-${index}`"
                  class="border-b border-dx-border pb-2 text-sm"
                >
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-dx-text">{{ item.name }}</span>
                    <span v-if="item.time" class="shrink-0 text-red-600">{{ item.time }}</span>
                  </div>
                  <p v-if="item.dayTitle" class="mt-1 text-xs text-dx-muted">{{ item.dayTitle }}</p>
                </li>
              </ul>
            </div>

            <div v-if="analysis.alternatives.length > 0">
              <h3 class="mb-2 text-sm font-semibold text-dx-text">{{ t('routes.missedAltTitle') }}</h3>
              <ul class="space-y-2 text-sm">
                <li
                  v-for="alt in analysis.alternatives"
                  :key="`${alt.forMissedPoi}-${alt.id}`"
                  class="border-b border-dashed border-dx-border pb-2"
                >
                  <span class="text-dx-primary">{{ alt.name }}</span>
                  <p class="mt-1 text-xs text-dx-muted">
                    {{ t('routes.missedAltFor', { name: alt.forMissedPoi }) }}
                  </p>
                </li>
              </ul>
            </div>
          </template>
        </div>

        <div class="flex justify-end gap-3">
          <button type="button" class="dx-btn-secondary" @click="handleClose">
            {{ t('routes.missedCancel') }}
          </button>
          <button
            v-if="analysis && analysis.missed.length > 0"
            type="button"
            class="dx-btn-primary"
            :disabled="recording"
            @click="handleRecord"
          >
            {{ recording ? t('common.loading') : t('routes.missedRecord') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { RouteMissedPoiAnalyzeResponse } from '@douxing/shared';
import { analyzeRouteMissedPois, recordRouteMissedPois } from '@/api/routes';
import { useLocale } from '@/i18n/useLocale';
import { appMessage } from '@/composables/useAppMessage';
import { getAppErrorMessage } from '@/utils/error-message';

const props = defineProps<{
  visible: boolean;
  routeId: number;
  dayIndex: number;
}>();

const emit = defineEmits<{
  close: [];
  recorded: [];
}>();

const { t } = useLocale();

const loading = ref(false);
const recording = ref(false);
const errorText = ref('');
const analysis = ref<RouteMissedPoiAnalyzeResponse | null>(null);

async function loadAnalysis() {
  if (!props.visible || !props.routeId) return;
  loading.value = true;
  errorText.value = '';
  analysis.value = null;

  try {
    analysis.value = await analyzeRouteMissedPois(props.routeId, {
      dayIndex: props.dayIndex,
    });
  } catch (err) {
    errorText.value = getAppErrorMessage(err, t('routes.missedAnalyzeFailed'));
  } finally {
    loading.value = false;
  }
}

async function handleRecord() {
  if (!analysis.value || analysis.value.missed.length === 0) return;
  recording.value = true;
  try {
    await recordRouteMissedPois(props.routeId, {
      items: analysis.value.missed.map((m) => ({ name: m.name, dayIndex: m.dayIndex })),
    });
    appMessage.success(t('routes.missedRecordSuccess'));
    emit('recorded');
    emit('close');
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('routes.missedRecordFailed')));
  } finally {
    recording.value = false;
  }
}

function handleClose() {
  if (recording.value) return;
  emit('close');
}

watch(
  () => [props.visible, props.routeId, props.dayIndex] as const,
  ([visible]) => {
    if (visible) void loadAnalysis();
  },
);
</script>
