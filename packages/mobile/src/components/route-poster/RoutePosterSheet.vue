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

      <view class="options-panel">
        <text class="options-title">{{ t('routes.poster.options.sectionTitle') }}</text>

        <view class="option-row">
          <text class="option-label">{{ t('routes.poster.options.subtitleLabel') }}</text>
          <input
            v-model="subtitleDraft"
            class="option-input"
            type="text"
            :placeholder="t('routes.poster.options.subtitlePlaceholder')"
            :disabled="generating"
            @blur="applySubtitleAndRefresh"
          />
        </view>

        <view class="option-row">
          <text class="option-label">{{ t('routes.poster.options.themeLabel') }}</text>
          <scroll-view scroll-x class="chip-scroll" :show-scrollbar="false">
            <view class="chip-row">
              <view
                v-for="preset in themePresets"
                :key="preset.id"
                class="option-chip"
                :class="{ active: renderOptions.themePresetId === preset.id }"
                @click="setThemePreset(preset.id)"
              >
                <view class="color-dot" :style="{ background: preset.sampleColor }" />
                <text>{{ t(preset.labelKey) }}</text>
              </view>
            </view>
          </scroll-view>
        </view>

        <view class="option-row">
          <text class="option-label">{{ t('routes.poster.options.poisPerDayLabel') }}</text>
          <view class="chip-row">
            <view
              v-for="count in poisPerDayChoices"
              :key="count"
              class="option-chip compact"
              :class="{ active: renderOptions.poisPerDay === count }"
              @click="setPoisPerDay(count)"
            >
              <text>{{ count }}</text>
            </view>
          </view>
        </view>

        <view class="option-row inline">
          <text class="option-label">{{ t('routes.poster.options.showTimeLabel') }}</text>
          <switch
            :checked="renderOptions.showTime"
            color="var(--dx-primary)"
            :disabled="generating"
            @change="onShowTimeChange"
          />
        </view>

        <view class="option-row">
          <text class="option-label">{{ t('routes.poster.options.stickerLabel') }}</text>
          <scroll-view scroll-x class="chip-scroll" :show-scrollbar="false">
            <view class="chip-row">
              <view
                v-for="sticker in stickerChoices"
                :key="sticker.id"
                class="option-chip compact"
                :class="{ active: renderOptions.stickerId === sticker.id }"
                @click="setSticker(sticker.id)"
              >
                <text>{{ t(sticker.labelKey) }}</text>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>

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
import type { PosterTemplateId, PosterPoisPerDay, PosterStickerId, PosterThemePresetId, PosterRenderOptions } from '@/poster/types';
import {
  loadStoredPosterRenderOptions,
  savePosterRenderOptions,
  POSTER_THEME_PRESETS,
} from '@/poster/poster-options';
import {
  getDefaultPosterTemplateId,
  POSTER_TEMPLATES,
  renderPoster,
} from '@/poster/registry';
import { loadPosterImages, loadPosterWxacode, POSTER_WXACODE_KEY } from '@/poster/load-poster-image';
import { fetchRouteShareLink } from '@/api/share';
import { buildJourneyPosterMaps, fetchJourneyAlbumByRoute } from '@/api/journey-albums';
import { getAppErrorMessage, getStoredUser } from '@/utils/request';

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
const renderOptions = ref<PosterRenderOptions>(loadStoredPosterRenderOptions());
const subtitleDraft = ref('');
const previewPath = ref('');
const generating = ref(false);
const saving = ref(false);
const posterCanvasHeight = ref(1334);

const poisPerDayChoices: PosterPoisPerDay[] = [2, 3, 4];

const themePresets = [
  { id: 'forest' as PosterThemePresetId, labelKey: 'routes.poster.options.themeForest', sampleColor: POSTER_THEME_PRESETS.forest.colors[0] },
  { id: 'ocean' as PosterThemePresetId, labelKey: 'routes.poster.options.themeOcean', sampleColor: POSTER_THEME_PRESETS.ocean.colors[0] },
  { id: 'sunset' as PosterThemePresetId, labelKey: 'routes.poster.options.themeSunset', sampleColor: POSTER_THEME_PRESETS.sunset.colors[0] },
  { id: 'classic' as PosterThemePresetId, labelKey: 'routes.poster.options.themeClassic', sampleColor: POSTER_THEME_PRESETS.classic.colors[0] },
];

const stickerChoices = [
  { id: 'none' as PosterStickerId, labelKey: 'routes.poster.options.stickerNone' },
  { id: 'travel' as PosterStickerId, labelKey: 'routes.poster.options.stickerTravel' },
  { id: 'food' as PosterStickerId, labelKey: 'routes.poster.options.stickerFood' },
  { id: 'family' as PosterStickerId, labelKey: 'routes.poster.options.stickerFamily' },
];

const canvasStyle = computed(
  () => `width:${POSTER_WIDTH}px;height:${posterCanvasHeight.value}px;`,
);

watch(
  () => [props.visible, props.route?.id] as const,
  async ([visible]) => {
    if (visible && props.route) {
      selectedTemplate.value = getDefaultPosterTemplateId();
      renderOptions.value = loadStoredPosterRenderOptions();
      subtitleDraft.value = renderOptions.value.subtitleOverride ?? '';
      previewPath.value = '';
      await nextTick();
      await generatePreview();
    }
  },
);

function persistOptions(patch: Partial<PosterRenderOptions>) {
  const next: PosterRenderOptions = { ...renderOptions.value, ...patch };
  if ('subtitleOverride' in patch && patch.subtitleOverride === undefined) {
    delete next.subtitleOverride;
  }
  renderOptions.value = next;
  savePosterRenderOptions(next);
}

async function applySubtitleAndRefresh() {
  const trimmed = subtitleDraft.value.trim();
  persistOptions({ subtitleOverride: trimmed || undefined });
  await generatePreview();
}

async function setThemePreset(id: PosterThemePresetId) {
  if (renderOptions.value.themePresetId === id || generating.value) return;
  persistOptions({ themePresetId: id });
  await generatePreview();
}

async function setPoisPerDay(count: PosterPoisPerDay) {
  if (renderOptions.value.poisPerDay === count || generating.value) return;
  persistOptions({ poisPerDay: count });
  await generatePreview();
}

async function onShowTimeChange(e: { detail: { value: boolean } }) {
  persistOptions({ showTime: e.detail.value });
  await generatePreview();
}

async function setSticker(id: PosterStickerId) {
  if (renderOptions.value.stickerId === id || generating.value) return;
  persistOptions({ stickerId: id });
  await generatePreview();
}

async function selectTemplate(id: PosterTemplateId) {
  if (selectedTemplate.value === id || generating.value) return;
  selectedTemplate.value = id;
  await generatePreview();
}

async function generatePreview() {
  if (!props.route || generating.value) return;

  let journeyHighlightByDay: string[][] | undefined;
  let journeyPhotoByPoiKey: Record<string, string> | undefined;
  if (getStoredUser()) {
    try {
      const albumDetail = await fetchJourneyAlbumByRoute(props.route.id);
      const maps = buildJourneyPosterMaps(albumDetail);
      journeyHighlightByDay = maps.journeyHighlightByDay;
      journeyPhotoByPoiKey = maps.journeyPhotoByPoiKey;
    } catch {
      // 无相册或无权访问时回退路线封面
    }
  }

  const payload = buildPosterPayload({
    route: props.route,
    locale: currentLocale.value,
    brandName: t('routes.poster.brandName'),
    brandTagline: t('routes.poster.brandTagline'),
    scanHint: payloadScanHint(),
    options: renderOptions.value,
    journeyHighlightByDay,
    journeyPhotoByPoiKey,
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
    // 优先小程序码（微信扫一扫直达）；失败再 URL Link，最后 H5 只读页
    await loadPosterWxacode(surface.canvas, payload.routeId, imageMap);
    let qrUrl: string | null = null;
    if (!imageMap.has(POSTER_WXACODE_KEY)) {
      try {
        const link = await fetchRouteShareLink(payload.routeId);
        if (link.url?.trim()) {
          qrUrl = link.url.trim();
        }
      } catch {
        /* URL Link 失败时再试 H5 */
      }
      if (!qrUrl) {
        qrUrl = payload.qrUrl;
      }
    }
    const renderPayload = {
      ...payload,
      qrUrl,
      brand: {
        ...payload.brand,
        scanHint:
          qrUrl || imageMap.has(POSTER_WXACODE_KEY)
            ? t('routes.poster.scanHint')
            : t('routes.poster.scanHintMpOnly'),
      },
    };
    renderPoster(selectedTemplate.value, surface.ctx, renderPayload, imageMap, canvasHeight);
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

/**
 * 海报生成前的扫码提示文案（最终文案在出码结果确定后再覆盖）。
 *
 * @returns i18n 后的扫码提示
 */
function payloadScanHint(): string {
  return t('routes.poster.scanHint');
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
.options-panel {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 16rpx;
  background: var(--dx-bg);
  border-radius: var(--dx-radius-md);
  max-height: 36vh;
  overflow-y: auto;
}
.options-title {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.option-row {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.option-row.inline {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.option-label {
  font-size: 22rpx;
  color: var(--dx-text-secondary);
}
.option-input {
  padding: 12rpx 16rpx;
  font-size: 24rpx;
  border-radius: var(--dx-radius-sm);
  border: 1rpx solid var(--dx-border);
  background: var(--dx-surface);
  color: var(--dx-text);
}
.chip-scroll {
  width: 100%;
  white-space: nowrap;
}
.chip-row {
  display: inline-flex;
  gap: 12rpx;
  flex-wrap: wrap;
}
.option-chip {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  border: 2rpx solid var(--dx-border);
  background: var(--dx-surface);
  font-size: 22rpx;
  color: var(--dx-text);
}
.option-chip.compact {
  min-width: 64rpx;
  justify-content: center;
}
.option-chip.active {
  border-color: var(--dx-primary);
  background: var(--dx-primary-light);
  color: var(--dx-primary);
}
.color-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  flex-shrink: 0;
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
