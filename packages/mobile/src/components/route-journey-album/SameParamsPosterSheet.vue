<template>
  <view v-if="visible" class="sheet-mask" @click="handleClose">
    <view class="sheet-panel" @click.stop>
      <view class="sheet-header">
        <text class="sheet-title">{{ t('journeyAlbum.sameParamsSheetTitle') }}</text>
        <text class="sheet-close" @click="handleClose">×</text>
      </view>
      <text v-if="paramSummary" class="sheet-summary">{{ paramSummary }}</text>
      <text class="sheet-hint">{{ t('journeyAlbum.sameParamsSheetHint') }}</text>

      <view class="preview-wrap">
        <image v-if="previewPath" class="preview-img" :src="previewPath" mode="widthFix" />
        <view v-else-if="generating" class="preview-state">{{ t('routes.poster.generating') }}</view>
        <view v-else class="preview-state">{{ t('routes.poster.previewEmpty') }}</view>
      </view>

      <view class="sheet-actions">
        <button class="btn-secondary" :disabled="generating" @click="generatePreview">
          {{ t('routes.poster.regenerate') }}
        </button>
        <button class="btn-primary" :loading="saving" @click="savePoster">
          {{ t('routes.poster.saveAlbum') }}
        </button>
      </view>

      <canvas
        id="sameParamsPosterCanvas"
        type="2d"
        class="poster-canvas-hidden"
        :style="canvasStyle"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue';
import type { TravelPhotoInfo } from '@douxing/shared';
import {
  findPhotosWithSameShootingParams,
  formatShootingParamsSummary,
  hasMatchableShootingParams,
} from '@douxing/shared';
import { useTf } from '@/i18n/useTf';
import { getAppErrorMessage } from '@/utils/request';
import {
  estimateSameParamsPosterHeight,
  renderSameParamsGridPoster,
} from '@/poster/templates/same-params-grid';
import { queryPosterCanvas, exportPosterCanvas, savePosterToAlbum } from '@/poster/canvas-export';
import { loadPosterImage, type PosterImageMap } from '@/poster/load-poster-image';
import { POSTER_WIDTH } from '@/poster/draw-utils';

const props = defineProps<{
  visible: boolean;
  referencePhoto: TravelPhotoInfo | null;
  albumPhotos: TravelPhotoInfo[];
  albumTitle: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t, tf } = useTf();
const componentInstance = getCurrentInstance()?.proxy;

const previewPath = ref('');
const generating = ref(false);
const saving = ref(false);
const posterCanvasHeight = ref(800);

const matchedPhotos = computed(() => {
  if (!props.referencePhoto) return [];
  return findPhotosWithSameShootingParams(props.albumPhotos, props.referencePhoto);
});

const paramSummary = computed(() =>
  formatShootingParamsSummary(props.referencePhoto?.shootingParams),
);

const canvasStyle = computed(
  () => `width:${POSTER_WIDTH}px;height:${posterCanvasHeight.value}px;`,
);

watch(
  () => [props.visible, props.referencePhoto?.id] as const,
  async ([visible]) => {
    if (visible && props.referencePhoto) {
      previewPath.value = '';
      await nextTick();
      await generatePreview();
    }
  },
);

async function generatePreview() {
  if (generating.value || !props.referencePhoto) return;
  if (!hasMatchableShootingParams(props.referencePhoto.shootingParams)) {
    uni.showToast({ title: t('journeyAlbum.sameParamsNoParams'), icon: 'none' });
    return;
  }
  const photos = matchedPhotos.value;
  if (photos.length === 0) {
    uni.showToast({ title: t('journeyAlbum.sameParamsNoMatch'), icon: 'none' });
    return;
  }

  generating.value = true;
  try {
    const summary = paramSummary.value;
    const estimatedHeight = estimateSameParamsPosterHeight(photos.length, summary);
    posterCanvasHeight.value = estimatedHeight;
    await nextTick();

    const surface = await queryPosterCanvas(
      'sameParamsPosterCanvas',
      componentInstance,
      estimatedHeight,
    );
    surface.ctx.clearRect(0, 0, surface.width, surface.height);

    const imageMap: PosterImageMap = new Map();
    const photoKeys: string[] = [];
    for (const photo of photos.slice(0, 9)) {
      photoKeys.push(photo.storedUrl);
      try {
        const img = await loadPosterImage(surface.canvas, photo.storedUrl);
        imageMap.set(photo.storedUrl, img);
      } catch {
        // 单张失败可忽略
      }
    }

    renderSameParamsGridPoster(
      surface.ctx,
      {
        title: props.albumTitle || t('journeyAlbum.sameParamsSheetTitle'),
        paramSummary: summary,
        photoKeys,
        countLabel: tf('journeyAlbum.sameParamsCount', { count: photos.length }),
      },
      imageMap,
      estimatedHeight,
    );

    previewPath.value = await exportPosterCanvas(surface);
  } catch (err) {
    uni.showToast({
      title: getAppErrorMessage(err, t('routes.poster.generateFailed')),
      icon: 'none',
    });
  } finally {
    generating.value = false;
  }
}

async function savePoster() {
  if (!previewPath.value || saving.value) return;
  saving.value = true;
  try {
    await savePosterToAlbum(previewPath.value);
    uni.showToast({ title: t('routes.poster.saveSuccess'), icon: 'success' });
  } catch (err) {
    uni.showToast({
      title: getAppErrorMessage(err, t('routes.poster.saveFailed')),
      icon: 'none',
    });
  } finally {
    saving.value = false;
  }
}

function handleClose() {
  emit('close');
}
</script>

<style scoped>
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
}
.sheet-panel {
  width: 100%;
  max-height: 92vh;
  background: var(--dx-surface);
  border-radius: 24rpx 24rpx 0 0;
  padding: 28rpx 32rpx 40rpx;
}
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.sheet-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.sheet-close {
  font-size: 40rpx;
  color: var(--dx-text-muted);
  padding: 8rpx;
}
.sheet-summary {
  display: block;
  font-size: 24rpx;
  color: var(--dx-primary);
  margin-bottom: 8rpx;
}
.sheet-hint {
  display: block;
  font-size: 22rpx;
  color: var(--dx-text-muted);
  margin-bottom: 20rpx;
}
.preview-wrap {
  min-height: 200rpx;
  margin-bottom: 20rpx;
}
.preview-img {
  width: 100%;
  border-radius: 16rpx;
}
.preview-state {
  padding: 48rpx;
  text-align: center;
  color: var(--dx-text-muted);
  font-size: 26rpx;
}
.sheet-actions {
  display: flex;
  gap: 16rpx;
}
.btn-primary,
.btn-secondary {
  flex: 1;
  font-size: 28rpx;
  border-radius: var(--dx-radius-lg);
}
.btn-primary {
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
}
.btn-secondary {
  background: var(--dx-bg);
  color: var(--dx-text);
  border: 1rpx solid var(--dx-border);
}
.poster-canvas-hidden {
  position: fixed;
  left: -9999px;
  top: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
