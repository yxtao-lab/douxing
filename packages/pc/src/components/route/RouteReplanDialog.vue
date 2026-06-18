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
          <h2 class="text-lg font-semibold text-dx-text">{{ t('routes.replanSheetTitle') }}</h2>
          <button type="button" class="text-2xl leading-none text-dx-muted" @click="handleClose">×</button>
        </div>

        <p class="text-sm text-dx-muted">{{ t('routes.replanSheetHint') }}</p>

        <div v-if="loading" class="py-6 text-sm text-dx-muted">{{ statusText }}</div>

        <div v-else-if="errorText" class="py-4 text-sm text-red-600">{{ errorText }}</div>

        <div v-else-if="preview" class="min-h-0 flex-1 overflow-y-auto space-y-4">
          <div
            v-if="!canApply"
            class="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            {{ t('routes.replanPublishedHint') }}
          </div>

          <div>
            <h3 class="mb-2 text-sm font-semibold text-dx-text">{{ t('routes.replanSegmentTitle') }}</h3>
            <ul class="space-y-2">
              <li
                v-for="(spot, index) in preview.segment.attractions"
                :key="`${spot.name}-${index}`"
                class="flex items-center justify-between gap-3 border-b border-dx-border pb-2 text-sm"
              >
                <span class="text-dx-text">{{ spot.name }}</span>
                <span v-if="spot.time" class="shrink-0 text-dx-primary">{{ spot.time }}</span>
              </li>
            </ul>
          </div>

          <div v-if="preview.diff.reordered.length > 0">
            <h3 class="mb-2 text-sm font-semibold text-dx-text">{{ t('routes.replanDiffTitle') }}</h3>
            <ul class="space-y-1 text-sm text-dx-muted">
              <li v-for="item in preview.diff.reordered" :key="item.name">
                {{
                  t('routes.replanDiffItem', {
                    name: item.name,
                    prev: item.previousOrder + 1,
                    next: item.newOrder + 1,
                  })
                }}
              </li>
            </ul>
          </div>

          <ul v-if="preview.segment.warnings.length > 0" class="space-y-1 text-sm text-amber-700">
            <li v-for="(warning, wi) in preview.segment.warnings" :key="wi">{{ warning }}</li>
          </ul>
        </div>

        <div class="flex justify-end gap-3">
          <button type="button" class="dx-btn-secondary" @click="handleClose">
            {{ t('routes.replanCancel') }}
          </button>
          <button
            v-if="preview && canApply"
            type="button"
            class="dx-btn-primary"
            :disabled="applying"
            @click="handleApply"
          >
            {{ applying ? t('common.loading') : t('routes.replanConfirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { RouteReplanContextInput, RouteReplanPreviewResponse } from '@douxing/shared';
import { applyRouteReplan, previewRouteReplan } from '@/api/routes';
import { useLocale } from '@/i18n/useLocale';
import { appMessage } from '@/composables/useAppMessage';
import { getAppErrorMessage } from '@/utils/error-message';

const props = defineProps<{
  visible: boolean;
  routeId: number;
  dayIndex: number;
  isDraft: boolean;
}>();

const emit = defineEmits<{
  close: [];
  applied: [];
}>();

const { t } = useLocale();

const loading = ref(false);
const applying = ref(false);
const locating = ref(false);
const errorText = ref('');
const preview = ref<RouteReplanPreviewResponse['preview'] | null>(null);
const canApply = ref(false);
const lastContext = ref<RouteReplanContextInput | null>(null);

const statusText = computed(() =>
  locating.value ? t('routes.replanLocating') : t('routes.replanLoading'),
);

function getBrowserLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('geolocation_unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

async function loadPreview() {
  if (!props.visible || !props.routeId) return;
  loading.value = true;
  locating.value = true;
  errorText.value = '';
  preview.value = null;
  canApply.value = false;
  lastContext.value = null;

  try {
    const location = await getBrowserLocation();
    locating.value = false;
    const context: RouteReplanContextInput = {
      dayIndex: props.dayIndex,
      latitude: location.latitude,
      longitude: location.longitude,
    };
    lastContext.value = context;
    const result = await previewRouteReplan(props.routeId, { context });
    preview.value = result.preview;
    canApply.value = result.canApply && props.isDraft;
  } catch (err) {
    errorText.value =
      err instanceof GeolocationPositionError || (err instanceof Error && err.message.includes('geolocation'))
        ? t('routes.replanLocationFailed')
        : getAppErrorMessage(err, t('routes.replanPreviewFailed'));
  } finally {
    loading.value = false;
    locating.value = false;
  }
}

async function handleApply() {
  if (!lastContext.value || !canApply.value) return;
  applying.value = true;
  try {
    await applyRouteReplan(props.routeId, { context: lastContext.value });
    appMessage.success(t('routes.replanApplySuccess'));
    emit('applied');
    emit('close');
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('routes.replanApplyFailed')));
  } finally {
    applying.value = false;
  }
}

function handleClose() {
  if (applying.value) return;
  emit('close');
}

watch(
  () => [props.visible, props.routeId, props.dayIndex] as const,
  ([visible]) => {
    if (visible) {
      void loadPreview();
    }
  },
);
</script>
