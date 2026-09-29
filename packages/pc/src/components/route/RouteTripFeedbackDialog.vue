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
          <h2 class="text-lg font-semibold text-dx-text">{{ t('routes.tripFeedbackTitle') }}</h2>
          <button type="button" class="text-2xl leading-none text-dx-muted" @click="handleClose">
            ×
          </button>
        </div>

        <p class="text-sm text-dx-muted">{{ t('routes.tripFeedbackHint') }}</p>

        <div v-if="loading" class="py-6 text-sm text-dx-muted">
          {{ t('routes.tripFeedbackLoading') }}
        </div>

        <div v-else-if="errorText" class="py-4 text-sm text-red-600">{{ errorText }}</div>

        <div v-else-if="feedback" class="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <p class="text-sm leading-relaxed text-dx-text">{{ feedback.diff.summaryText }}</p>

          <div>
            <h3 class="mb-2 text-sm font-semibold text-dx-text">
              {{ t('routes.tripFeedbackVisited') }}
            </h3>
            <p v-if="feedback.diff.visited.length === 0" class="text-sm text-dx-muted">
              {{ t('routes.tripFeedbackVisitedEmpty') }}
            </p>
            <ul v-else class="space-y-1 text-sm text-dx-text">
              <li v-for="(item, index) in feedback.diff.visited" :key="`v-${item.name}-${index}`">
                {{ item.name }}
              </li>
            </ul>
          </div>

          <div>
            <h3 class="mb-2 text-sm font-semibold text-dx-text">
              {{ t('routes.tripFeedbackSkipped') }}
            </h3>
            <p v-if="feedback.diff.skipped.length === 0" class="text-sm text-dx-muted">
              {{ t('routes.tripFeedbackSkippedEmpty') }}
            </p>
            <ul v-else class="space-y-1 text-sm text-amber-800">
              <li v-for="(item, index) in feedback.diff.skipped" :key="`s-${item.name}-${index}`">
                {{ item.name }}
              </li>
            </ul>
          </div>

          <p
            v-if="feedback.diff.rating.averageRating != null"
            class="text-sm text-dx-muted"
          >
            {{
              t('routes.tripFeedbackRating', {
                score: String(feedback.diff.rating.averageRating),
                count: String(feedback.diff.rating.ratedCount),
              })
            }}
          </p>

          <p v-if="isFinalized" class="text-sm text-dx-primary">
            {{ t('routes.tripFeedbackFinalized') }}
          </p>
        </div>

        <div class="flex justify-end gap-3">
          <button type="button" class="dx-btn-secondary" @click="handleClose">
            {{ t('routes.tripFeedbackClose') }}
          </button>
          <button
            v-if="feedback && !isFinalized"
            type="button"
            class="dx-btn-primary"
            :disabled="finalizing"
            @click="handleFinalize"
          >
            {{ finalizing ? t('common.loading') : t('routes.tripFeedbackFinalize') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { TripFeedbackStatus, type TripFeedbackInfo } from '@douxing/shared';
import {
  finalizeRouteTripFeedback,
  getRouteTripFeedback,
  previewRouteTripFeedback,
} from '@/api/routes';
import { useLocale } from '@/i18n/useLocale';
import { appMessage } from '@/composables/useAppMessage';
import { getAppErrorMessage } from '@/utils/error-message';

const props = defineProps<{
  visible: boolean;
  routeId: number;
}>();

const emit = defineEmits<{
  close: [];
  finalized: [];
}>();

const { t } = useLocale();

const loading = ref(false);
const finalizing = ref(false);
const errorText = ref('');
const feedback = ref<TripFeedbackInfo | null>(null);

const isFinalized = computed(
  () => feedback.value?.status === TripFeedbackStatus.FINALIZED,
);

/**
 * 加载已确认复盘，若无则拉取预览。
 */
async function loadFeedback() {
  if (!props.visible || !props.routeId) return;
  loading.value = true;
  errorText.value = '';
  feedback.value = null;
  try {
    const saved = await getRouteTripFeedback(props.routeId);
    if (saved?.status === TripFeedbackStatus.FINALIZED) {
      feedback.value = saved;
    } else {
      feedback.value = await previewRouteTripFeedback(props.routeId);
    }
  } catch (err) {
    errorText.value = getAppErrorMessage(err, t('routes.tripFeedbackLoadFailed'));
  } finally {
    loading.value = false;
  }
}

/**
 * 确认复盘并回流。
 */
async function handleFinalize() {
  if (!feedback.value || isFinalized.value) return;
  finalizing.value = true;
  try {
    feedback.value = await finalizeRouteTripFeedback(props.routeId);
    appMessage.success(t('routes.tripFeedbackFinalizeSuccess'));
    emit('finalized');
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('routes.tripFeedbackFinalizeFailed')));
  } finally {
    finalizing.value = false;
  }
}

/**
 * 关闭弹层。
 */
function handleClose() {
  emit('close');
}

watch(
  () => props.visible,
  (v) => {
    if (v) void loadFeedback();
  },
);
</script>
