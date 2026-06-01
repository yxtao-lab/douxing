<template>
  <view v-if="visible" class="poster-mask" @click="handleClose">
    <view class="poster-sheet" @click.stop>
      <view class="poster-header">
        <text class="poster-title">{{ t('routes.poster.sheetTitle') }}</text>
        <text class="poster-close" @click="handleClose">×</text>
      </view>

      <text class="poster-hint">{{ t('routes.poster.sheetHint') }}</text>

      <scroll-view scroll-x class="template-scroll" :show-scrollbar="false">
        <view class="template-row">
          <view
            v-for="item in templates"
            :key="item.id"
            class="template-chip"
            :class="{ active: selectedTemplate === item.id }"
            @click="selectTemplate(item.id)"
          >
            <text class="template-name">{{ t(item.nameKey) }}</text>
            <text class="template-desc">{{ t(item.descKey) }}</text>
          </view>
        </view>
      </scroll-view>

      <view class="preview-wrap">
        <image
          v-if="previewPath"
          class="preview-image"
          :src="previewPath"
          mode="widthFix"
          show-menu-by-longpress
        />
        <view v-else-if="generating" class="preview-loading">
          <text>{{ t('routes.poster.generating') }}</text>
        </view>
        <view v-else class="preview-loading">
          <text>{{ t('routes.poster.previewEmpty') }}</text>
        </view>
      </view>

      <view class="poster-actions">
        <button class="btn-secondary" :disabled="generating" @click="handleRegenerate">
          {{ t('routes.poster.regenerate') }}
        </button>
        <button class="btn-primary" :loading="saving" :disabled="!previewPath || generating" @click="handleSave">
          {{ t('routes.poster.saveAlbum') }}
        </button>
      </view>

      <!-- 离屏 Canvas -->
      <canvas
        id="routePosterCanvas"
        canvas-id="routePosterCanvas"
        type="2d"
        class="poster-canvas-hidden"
        :style="canvasStyle"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue';
import type { TravelRouteInfo } from '@douxing/shared';
import { useTf } from '@/i18n/useTf';
import { useLocale } from '@/i18n/useLocale';
import { buildPosterPayload } from '@/poster/build-poster-payload';
import {
  exportPosterCanvas,
  openAlbumSetting,
  queryPosterCanvas,
  savePosterToAlbum,
} from '@/poster/canvas-export';
import { POSTER_WIDTH } from '@/poster/draw-utils';
import { POSTER_HEIGHT } from '@/poster/draw-utils';
import { measurePosterHeight } from '@/poster/poster-layout';
import type { PosterTemplateId } from '@/poster/types';
import {
  getDefaultPosterTemplateId,
  POSTER_TEMPLATES,
  renderPoster,
} from '@/poster/registry';
import { loadPosterImages } from '@/poster/load-poster-image';
import { getAppErrorMessage } from '@/utils/request';

const props = defineProps<{
  visible: boolean;
  route: TravelRouteInfo | null;
}>();

const emit = defineEmits<{
  close: [];
  generated: [path: string];
}>();

const { t } = useTf();
const { currentLocale } = useLocale();
const componentInstance = getCurrentInstance()?.proxy ?? null;

const templates = POSTER_TEMPLATES;
const selectedTemplate = ref<PosterTemplateId>(getDefaultPosterTemplateId());
const previewPath = ref('');
const generating = ref(false);
const saving = ref(false);
const posterCanvasHeight = ref(1334);

const canvasStyle = computed(
  () => `width:${POSTER_WIDTH}px;height:${posterCanvasHeight.value}px;`,
);

watch(
  () => [props.visible, props.route?.id] as const,
  async ([visible]) => {
    if (visible && props.route) {
      selectedTemplate.value = getDefaultPosterTemplateId();
      previewPath.value = '';
      await nextTick();
      await generatePreview();
    }
  },
);

async function selectTemplate(id: PosterTemplateId) {
  if (selectedTemplate.value === id || generating.value) return;
  selectedTemplate.value = id;
  await generatePreview();
}

async function generatePreview() {
  if (!props.route || generating.value) return;
  const payload = buildPosterPayload({
    route: props.route,
    locale: currentLocale.value,
    brandName: t('routes.poster.brandName'),
    brandTagline: t('routes.poster.brandTagline'),
    scanHint: payloadScanHint(),
  });
  if (!payload) {
    uni.showToast({ title: t('routes.poster.noItinerary'), icon: 'none' });
    return;
  }

  generating.value = true;
  try {
    posterCanvasHeight.value = POSTER_HEIGHT;
    await nextTick();
    const probe = await queryPosterCanvas('routePosterCanvas', componentInstance, POSTER_HEIGHT);
    const canvasHeight = measurePosterHeight(probe.ctx, payload, selectedTemplate.value);
    posterCanvasHeight.value = canvasHeight;
    await nextTick();
    const surface =
      canvasHeight === POSTER_HEIGHT
        ? probe
        : await queryPosterCanvas('routePosterCanvas', componentInstance, canvasHeight);
    surface.ctx.clearRect(0, 0, surface.width, surface.height);
    const imageMap = await loadPosterImages(surface.canvas, payload);
    renderPoster(selectedTemplate.value, surface.ctx, payload, imageMap, canvasHeight);
    const path = await exportPosterCanvas(surface);
    previewPath.value = path;
    emit('generated', path);
  } catch (err) {
    uni.showToast({
      title: getAppErrorMessage(err, t('routes.poster.generateFailed')),
      icon: 'none',
    });
  } finally {
    generating.value = false;
  }
}

function payloadScanHint(): string {
  const base = import.meta.env.VITE_H5_BASE_URL?.trim();
  return base ? t('routes.poster.scanHint') : t('routes.poster.scanHintMpOnly');
}

function handleClose() {
  emit('close');
}

async function handleRegenerate() {
  await generatePreview();
}

async function handleSave() {
  if (!previewPath.value) return;
  saving.value = true;
  try {
    await savePosterToAlbum(previewPath.value);
    uni.showToast({ title: t('routes.poster.saveSuccess'), icon: 'success' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'album_permission_denied') {
      uni.showModal({
        title: t('routes.poster.albumPermissionTitle'),
        content: t('routes.poster.albumPermissionBody'),
        confirmText: t('routes.poster.openSettings'),
        success: async (res) => {
          if (res.confirm) {
            const granted = await openAlbumSetting();
            if (granted) {
              await handleSave();
            }
          }
        },
      });
      return;
    }
    uni.showToast({
      title: getAppErrorMessage(err, t('routes.poster.saveFailed')),
      icon: 'none',
    });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.poster-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.poster-sheet {
  width: 100%;
  max-height: 92vh;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-xl) var(--dx-radius-xl) 0 0;
  padding: 28rpx 32rpx calc(28rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.poster-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.poster-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--dx-text);
}
.poster-close {
  width: 48rpx;
  height: 48rpx;
  line-height: 48rpx;
  text-align: center;
  font-size: 40rpx;
  color: var(--dx-text-muted);
}
.poster-hint {
  font-size: 22rpx;
  color: var(--dx-text-muted);
  line-height: 1.5;
}
.template-scroll {
  width: 100%;
  white-space: nowrap;
}
.template-row {
  display: inline-flex;
  gap: 16rpx;
  padding-bottom: 8rpx;
}
.template-chip {
  width: 280rpx;
  padding: 20rpx;
  border-radius: var(--dx-radius-md);
  border: 2rpx solid var(--dx-border);
  background: var(--dx-bg);
  box-sizing: border-box;
}
.template-chip.active {
  border-color: var(--dx-primary);
  background: var(--dx-primary-light);
}
.template-name {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.template-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 20rpx;
  color: var(--dx-text-muted);
  line-height: 1.4;
  white-space: normal;
}
.preview-wrap {
  min-height: 420rpx;
  max-height: 52vh;
  overflow: auto;
  background: var(--dx-bg);
  border-radius: var(--dx-radius-md);
  padding: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-image {
  width: 100%;
  border-radius: var(--dx-radius-sm);
}
.preview-loading {
  color: var(--dx-text-muted);
  font-size: 24rpx;
  padding: 48rpx 24rpx;
  text-align: center;
}
.poster-actions {
  display: flex;
  gap: 16rpx;
}
.btn-secondary,
.btn-primary {
  flex: 1;
  margin: 0;
  font-size: 28rpx;
  border-radius: var(--dx-radius-lg);
  border: none;
}
.btn-secondary {
  background: var(--dx-bg);
  color: var(--dx-text);
}
.btn-primary {
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
}
.poster-canvas-hidden {
  position: fixed;
  left: -9999px;
  top: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
