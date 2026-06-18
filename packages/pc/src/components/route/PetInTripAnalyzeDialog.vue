<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[1200] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      @click="handleClose"
    >
      <div
        class="flex max-h-[75vh] w-full max-w-lg flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl"
        @click.stop
      >
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-dx-text">{{ titleText }}</h2>
          <button type="button" class="text-2xl leading-none text-dx-muted" @click="handleClose">×</button>
        </div>

        <div v-if="loading" class="py-6 text-sm text-dx-muted">{{ analyzingText }}</div>
        <div v-else-if="errorText" class="py-4 text-sm text-red-600">{{ errorText }}</div>
        <div v-else-if="result" class="min-h-0 flex-1 overflow-y-auto space-y-4 text-sm">
          <div>
            <h3 class="mb-2 font-semibold text-dx-text">{{ insightTitle }}</h3>
            <p class="text-dx-muted">{{ result.insight }}</p>
          </div>
          <div>
            <h3 class="mb-2 font-semibold text-dx-text">{{ replyTitle }}</h3>
            <p class="text-dx-muted">{{ result.petReply }}</p>
          </div>
        </div>

        <div class="flex justify-end">
          <button type="button" class="dx-btn-secondary" @click="handleClose">
            {{ t('routes.missedCancel') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PetAnalyzeResult } from '@douxing/shared';
import {
  formatPetMemoryWallAnalyzeInTrip,
  formatPetMemoryWallAnalyzing,
  formatPetMemoryWallInsightTitle,
  formatPetMemoryWallPetReplyTitle,
} from '@douxing/shared';
import { analyzeTravelPet } from '@/api/pets';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';

const props = defineProps<{
  visible: boolean;
  routeId: number;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t, locale } = useLocale();

const loading = ref(false);
const errorText = ref('');
const result = ref<PetAnalyzeResult | null>(null);

const titleText = computed(() => formatPetMemoryWallAnalyzeInTrip(locale.value));
const analyzingText = computed(() => formatPetMemoryWallAnalyzing(locale.value));
const insightTitle = computed(() => formatPetMemoryWallInsightTitle(locale.value));
const replyTitle = computed(() => formatPetMemoryWallPetReplyTitle(locale.value));

async function loadAnalyze() {
  if (!props.visible || !props.routeId) return;
  loading.value = true;
  errorText.value = '';
  result.value = null;
  try {
    result.value = await analyzeTravelPet({ scene: 'in_trip', routeId: props.routeId });
  } catch (err) {
    errorText.value = getAppErrorMessage(err, t('routes.inTripAnalyzeFailed'));
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  emit('close');
}

watch(
  () => [props.visible, props.routeId] as const,
  ([visible]) => {
    if (visible) void loadAnalyze();
  },
);
</script>
