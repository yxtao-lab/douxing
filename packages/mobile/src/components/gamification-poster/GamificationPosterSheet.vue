<template>
  <view v-if="visible" class="poster-mask" @click="handleClose">
    <view class="poster-sheet" @click.stop>
      <view class="poster-header">
        <text class="poster-title">{{ sheetTitle }}</text>
        <text class="poster-close" @click="handleClose">×</text>
      </view>

      <text class="poster-hint">{{ sheetHint }}</text>

      <PosterThemeChipRow
        v-model="themePresetId"
        :disabled="generating"
        @update:model-value="onThemeChange"
      />

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

      <canvas
        id="gamificationPosterCanvas"
        canvas-id="gamificationPosterCanvas"
        type="2d"
        class="poster-canvas-hidden"
        :style="canvasStyle"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue';
import type { AchievementCatalogItem, BadgeCatalogItem } from '@douxing/shared';
import { useTf } from '@/i18n/useTf';
import { useLocale } from '@/i18n/useLocale';
import { buildGamificationPosterPayload } from '@/poster/build-gamification-poster-payload';
import type { GamificationPosterKind } from '@/poster/types-gamification';
import {
  renderGamificationPoster,
  estimateGamificationPosterHeight,
} from '@/poster/templates/achievement-showcase';
import {
  exportPosterCanvas,
  openAlbumSetting,
  queryPosterCanvas,
  savePosterToAlbum,
} from '@/poster/canvas-export';
import { loadPosterImage } from '@/poster/load-poster-image';
import type { PosterImageMap } from '@/poster/load-poster-image';
import { POSTER_WIDTH } from '@/poster/draw-utils';
import {
  loadStoredPosterRenderOptions,
  mergePosterRenderOptions,
  savePosterRenderOptions,
} from '@/poster/poster-options';
import type { PosterThemePresetId } from '@/poster/types';
import PosterThemeChipRow from '@/components/poster/PosterThemeChipRow.vue';
import { getStoredUser } from '@/utils/auth-storage';
import { getAppErrorMessage } from '@/utils/request';

const props = defineProps<{
  visible: boolean;
  kind: GamificationPosterKind;
  achievements?: AchievementCatalogItem[];
  badges?: BadgeCatalogItem[];
}>();

const emit = defineEmits<{
  close: [];
  generated: [path: string];
}>();

const { t } = useTf();
const { currentLocale } = useLocale();
const componentInstance = getCurrentInstance()?.proxy ?? null;

const previewPath = ref('');
const generating = ref(false);
const saving = ref(false);
const posterCanvasHeight = ref(900);
const themePresetId = ref<PosterThemePresetId>(loadStoredPosterRenderOptions().themePresetId);

const sheetTitle = computed(() =>
  props.kind === 'achievements'
    ? t('achievements.posterTitle')
    : t('badges.posterTitle'),
);

const sheetHint = computed(() =>
  props.kind === 'achievements'
    ? t('achievements.posterHint')
    : t('badges.posterHint'),
);

const canvasStyle = computed(
  () => `width:${POSTER_WIDTH}px;height:${posterCanvasHeight.value}px;`,
);

watch(
  () => [props.visible, props.kind, props.achievements?.length, props.badges?.length] as const,
  async ([visible]) => {
    if (visible) {
      previewPath.value = '';
      await nextTick();
      await generatePreview();
    }
  },
);

function catalogForKind(): AchievementCatalogItem[] | BadgeCatalogItem[] {
  return props.kind === 'achievements' ? props.achievements ?? [] : props.badges ?? [];
}

function noDataMessage(): string {
  return props.kind === 'achievements'
    ? t('achievements.posterNoUnlocked')
    : t('badges.posterNoUnlocked');
}

async function generatePreview() {
  if (generating.value) return;

  const catalog = catalogForKind();
  if (catalog.length === 0) {
    uni.showToast({ title: noDataMessage(), icon: 'none' });
    return;
  }

  const user = getStoredUser();
  if (!user) {
    uni.showToast({ title: t('checkins.posterLoginRequired'), icon: 'none' });
    return;
  }

  generating.value = true;
  try {
    const payload = buildGamificationPosterPayload({
      kind: props.kind,
      catalog,
      user,
      locale: currentLocale.value,
      brandName: t('routes.poster.brandName'),
      brandTagline: t('routes.poster.brandTagline'),
      scanHint: payloadScanHint(),
      themePresetId: themePresetId.value,
    });
    if (!payload) {
      uni.showToast({ title: noDataMessage(), icon: 'none' });
      return;
    }

    const estimatedHeight = estimateGamificationPosterHeight(payload);
    posterCanvasHeight.value = estimatedHeight;
    await nextTick();

    const surface = await queryPosterCanvas(
      'gamificationPosterCanvas',
      componentInstance,
      estimatedHeight,
    );
    surface.ctx.clearRect(0, 0, surface.width, surface.height);

    const imageMap: PosterImageMap = new Map();
    if (payload.avatarUrl) {
      try {
        const img = await loadPosterImage(surface.canvas, payload.avatarUrl);
        imageMap.set(payload.avatarUrl, img);
      } catch {
        // 头像加载失败可忽略
      }
    }

    renderGamificationPoster(surface.ctx, payload, imageMap, estimatedHeight);
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
  if (base) return t('routes.poster.scanHint');
  return t('routes.poster.scanHintMpOnly');
}

function handleClose() {
  emit('close');
}

async function handleRegenerate() {
  await generatePreview();
}

function onThemeChange(id: PosterThemePresetId) {
  themePresetId.value = id;
  savePosterRenderOptions(
    mergePosterRenderOptions({ ...loadStoredPosterRenderOptions(), themePresetId: id }),
  );
  void generatePreview();
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
