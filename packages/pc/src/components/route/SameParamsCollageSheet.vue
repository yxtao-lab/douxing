<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="handleClose"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" @click.stop>
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-dx-text">{{ t('journeyAlbum.sameParamsSheetTitle') }}</h3>
          <button type="button" class="text-dx-muted hover:text-dx-text" @click="handleClose">×</button>
        </div>
        <p v-if="paramSummary" class="mb-2 text-sm text-dx-primary">{{ paramSummary }}</p>
        <p class="mb-4 text-sm text-dx-muted">{{ t('journeyAlbum.sameParamsSheetHint') }}</p>

        <div class="mb-4 flex min-h-[160px] items-center justify-center rounded-xl bg-dx-bg p-4">
          <img v-if="previewDataUrl" :src="previewDataUrl" alt="" class="max-h-80 w-full object-contain" />
          <p v-else-if="generating" class="text-sm text-dx-muted">{{ t('routes.poster.generating') }}</p>
          <p v-else class="text-sm text-dx-muted">{{ t('routes.poster.previewEmpty') }}</p>
        </div>

        <div class="flex justify-end gap-3">
          <button type="button" class="dx-btn-secondary" :disabled="generating" @click="generatePreview">
            {{ t('routes.poster.regenerate') }}
          </button>
          <button
            type="button"
            class="dx-btn-primary"
            :disabled="!previewDataUrl || saving"
            @click="downloadCollage"
          >
            {{ saving ? t('common.loading') : t('journeyAlbum.sameParamsDownload') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { TravelPhotoInfo } from '@douxing/shared';
import {
  findPhotosWithSameShootingParams,
  formatShootingParamsSummary,
  hasMatchableShootingParams,
} from '@douxing/shared';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';
import { downloadDataUrl, renderSameParamsCollage } from '@/utils/same-params-collage';

const props = defineProps<{
  visible: boolean;
  referencePhoto: TravelPhotoInfo | null;
  albumPhotos: TravelPhotoInfo[];
  albumTitle: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useLocale();

const previewDataUrl = ref('');
const generating = ref(false);
const saving = ref(false);

const matchedPhotos = computed(() => {
  if (!props.referencePhoto) return [];
  return findPhotosWithSameShootingParams(props.albumPhotos, props.referencePhoto);
});

const paramSummary = computed(() =>
  formatShootingParamsSummary(props.referencePhoto?.shootingParams),
);

watch(
  () => [props.visible, props.referencePhoto?.id] as const,
  ([visible]) => {
    if (visible && props.referencePhoto) {
      previewDataUrl.value = '';
      void generatePreview();
    }
  },
);

async function generatePreview() {
  if (generating.value || !props.referencePhoto) return;
  if (!hasMatchableShootingParams(props.referencePhoto.shootingParams)) {
    window.alert(t('journeyAlbum.sameParamsNoParams'));
    return;
  }
  const photos = matchedPhotos.value;
  if (photos.length === 0) {
    window.alert(t('journeyAlbum.sameParamsNoMatch'));
    return;
  }

  generating.value = true;
  try {
    const result = await renderSameParamsCollage(photos, {
      title: props.albumTitle || t('journeyAlbum.sameParamsSheetTitle'),
      countLabel: t('journeyAlbum.sameParamsCount', { count: photos.length }),
    });
    previewDataUrl.value = result.dataUrl;
  } catch (err) {
    window.alert(getAppErrorMessage(err, t('routes.poster.generateFailed')));
  } finally {
    generating.value = false;
  }
}

function downloadCollage() {
  if (!previewDataUrl.value) return;
  saving.value = true;
  try {
    downloadDataUrl(previewDataUrl.value, `same-params-${Date.now()}.jpg`);
  } finally {
    saving.value = false;
  }
}

function handleClose() {
  emit('close');
}
</script>
