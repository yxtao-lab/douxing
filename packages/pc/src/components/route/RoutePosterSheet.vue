<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      @click.self="handleClose"
    >
      <div
        class="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        @click.stop
      >
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-dx-text">{{ t('routes.poster.sheetTitle') }}</h2>
          <button type="button" class="text-xl text-dx-muted hover:text-dx-text" @click="handleClose">
            ×
          </button>
        </div>

        <p class="mb-4 text-sm text-dx-muted">{{ t('routes.poster.sheetHint') }}</p>

        <div class="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="item in templates"
            :key="item.id"
            type="button"
            class="min-w-[140px] shrink-0 rounded-xl border px-3 py-2 text-left text-sm transition"
            :class="
              selectedTemplate === item.id
                ? 'border-dx-primary bg-dx-primary-light'
                : 'border-dx-border hover:border-dx-primary/40'
            "
            @click="selectTemplate(item.id)"
          >
            <span class="block font-medium">{{ t(item.nameKey) }}</span>
            <span class="mt-0.5 block text-xs text-dx-muted">{{ t(item.descKey) }}</span>
          </button>
        </div>

        <div class="mb-4 space-y-3 rounded-xl border border-dx-border p-3">
          <p class="text-sm font-medium text-dx-text">{{ t('routes.poster.options.sectionTitle') }}</p>
          <label class="block text-sm">
            <span class="mb-1 block text-dx-muted">{{ t('routes.poster.options.subtitleLabel') }}</span>
            <input
              v-model="subtitleDraft"
              type="text"
              class="w-full rounded-lg border border-dx-border px-3 py-2"
              :placeholder="t('routes.poster.options.subtitlePlaceholder')"
              :disabled="generating"
              @blur="applySubtitleAndRefresh"
            />
          </label>
          <div>
            <span class="mb-2 block text-sm text-dx-muted">{{ t('routes.poster.options.themeLabel') }}</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="preset in themePresets"
                :key="preset.id"
                type="button"
                class="flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                :class="
                  renderOptions.themePresetId === preset.id
                    ? 'border-dx-primary bg-dx-primary-light'
                    : 'border-dx-border'
                "
                @click="setThemePreset(preset.id)"
              >
                <span class="h-3 w-3 rounded-full" :style="{ background: preset.sampleColor }" />
                {{ t(preset.labelKey) }}
              </button>
            </div>
          </div>
          <div>
            <span class="mb-2 block text-sm text-dx-muted">{{ t('routes.poster.options.poisPerDayLabel') }}</span>
            <div class="flex gap-2">
              <button
                v-for="count in poisPerDayChoices"
                :key="count"
                type="button"
                class="rounded-full border px-3 py-1 text-xs"
                :class="
                  renderOptions.poisPerDay === count
                    ? 'border-dx-primary bg-dx-primary-light'
                    : 'border-dx-border'
                "
                @click="setPoisPerDay(count)"
              >
                {{ count }}
              </button>
            </div>
          </div>
          <label class="flex items-center justify-between text-sm">
            <span>{{ t('routes.poster.options.showTimeLabel') }}</span>
            <input
              type="checkbox"
              :checked="renderOptions.showTime"
              :disabled="generating"
              @change="onShowTimeChange"
            />
          </label>
        </div>

        <div class="mb-4 flex min-h-[200px] flex-1 items-center justify-center overflow-auto rounded-xl bg-dx-bg p-3">
          <img v-if="previewPath" :src="previewPath" alt="" class="max-h-[50vh] w-auto rounded-lg shadow" />
          <p v-else-if="generating" class="text-sm text-dx-muted">{{ t('routes.poster.generating') }}</p>
          <p v-else class="text-sm text-dx-muted">{{ t('routes.poster.previewEmpty') }}</p>
        </div>

        <div class="flex gap-3">
          <button type="button" class="dx-btn-secondary flex-1" :disabled="generating" @click="handleRegenerate">
            {{ t('routes.poster.regenerate') }}
          </button>
          <button
            type="button"
            class="dx-btn-primary flex-1"
            :disabled="!previewPath || generating"
            @click="handleDownload"
          >
            {{ t('routes.poster.downloadPng') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { TravelRouteInfo } from '@douxing/shared';
import { fetchRouteShareLink } from '@/api/share';
import { buildJourneyPosterMaps, fetchJourneyAlbumByRoute } from '@/api/journey-albums';
import { getAppErrorMessage } from '@/utils/error-message';
import { useUserStore } from '@/stores/user';
import { useLocale } from '@/i18n/useLocale';
import { appMessage } from '@/composables/useAppMessage';
import { buildPosterPayload } from '@/poster/build-poster-payload';
import {
  createPosterCanvas,
  downloadPosterBlobUrl,
  exportPosterCanvas,
  revokePosterBlobUrl,
} from '@/poster/canvas-export';
import { POSTER_HEIGHT } from '@/poster/draw-utils';
import {
  loadPosterImages,
  loadPosterWxacode,
  POSTER_WXACODE_KEY,
} from '@/poster/load-poster-image';
import { measurePosterHeight } from '@/poster/poster-layout';
import {
  loadStoredPosterRenderOptions,
  POSTER_THEME_PRESETS,
  savePosterRenderOptions,
} from '@/poster/poster-options';
import {
  getDefaultPosterTemplateId,
  POSTER_TEMPLATES,
  renderPoster,
} from '@/poster/registry';
import type {
  PosterPoisPerDay,
  PosterRenderOptions,
  PosterTemplateId,
  PosterThemePresetId,
} from '@/poster/types';

const props = defineProps<{
  visible: boolean;
  route: TravelRouteInfo | null;
}>();

const emit = defineEmits<{
  close: [];
  generated: [path: string];
}>();

const { t, currentLocale } = useLocale();
const userStore = useUserStore();

const templates = POSTER_TEMPLATES;
const selectedTemplate = ref<PosterTemplateId>(getDefaultPosterTemplateId());
const renderOptions = ref<PosterRenderOptions>(loadStoredPosterRenderOptions());
const subtitleDraft = ref('');
const previewPath = ref('');
const generating = ref(false);

const poisPerDayChoices: PosterPoisPerDay[] = [2, 3, 4];

const themePresets = [
  { id: 'forest' as PosterThemePresetId, labelKey: 'routes.poster.options.themeForest', sampleColor: POSTER_THEME_PRESETS.forest.colors[0] },
  { id: 'ocean' as PosterThemePresetId, labelKey: 'routes.poster.options.themeOcean', sampleColor: POSTER_THEME_PRESETS.ocean.colors[0] },
  { id: 'sunset' as PosterThemePresetId, labelKey: 'routes.poster.options.themeSunset', sampleColor: POSTER_THEME_PRESETS.sunset.colors[0] },
  { id: 'classic' as PosterThemePresetId, labelKey: 'routes.poster.options.themeClassic', sampleColor: POSTER_THEME_PRESETS.classic.colors[0] },
];

watch(
  () => [props.visible, props.route?.id] as const,
  async ([visible]) => {
    if (visible && props.route) {
      if (previewPath.value) revokePosterBlobUrl(previewPath.value);
      selectedTemplate.value = getDefaultPosterTemplateId();
      renderOptions.value = loadStoredPosterRenderOptions();
      subtitleDraft.value = renderOptions.value.subtitleOverride ?? '';
      previewPath.value = '';
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

async function onShowTimeChange(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  persistOptions({ showTime: checked });
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
  if (userStore.user) {
    try {
      const albumDetail = await fetchJourneyAlbumByRoute(props.route.id);
      const maps = buildJourneyPosterMaps(albumDetail);
      journeyHighlightByDay = maps.journeyHighlightByDay;
      journeyPhotoByPoiKey = maps.journeyPhotoByPoiKey;
    } catch {
      /* 无相册时回退路线封面 */
    }
  }

  const payload = buildPosterPayload({
    route: props.route,
    locale: currentLocale.value,
    brandName: t('routes.poster.brandName'),
    brandTagline: t('routes.poster.brandTagline'),
    scanHint: t('routes.poster.scanHint'),
    options: renderOptions.value,
    journeyHighlightByDay,
    journeyPhotoByPoiKey,
  });
  if (!payload) {
    appMessage.warning(t('routes.poster.noItinerary'));
    return;
  }

  generating.value = true;
  try {
    const probe = createPosterCanvas(POSTER_HEIGHT);
    const canvasHeight = measurePosterHeight(probe.ctx, payload, selectedTemplate.value);
    const surface = canvasHeight === POSTER_HEIGHT ? probe : createPosterCanvas(canvasHeight);
    surface.ctx.clearRect(0, 0, surface.width, surface.height);

    const imageMap = await loadPosterImages(payload);
    let qrUrl = payload.qrUrl;
    if (!qrUrl) {
      await loadPosterWxacode(payload.routeId, imageMap);
      if (!imageMap.has(POSTER_WXACODE_KEY)) {
        try {
          const link = await fetchRouteShareLink(payload.routeId);
          if (link.url?.trim()) qrUrl = link.url.trim();
        } catch {
          /* ignore */
        }
      }
    }

    const renderPayload = {
      ...payload,
      qrUrl,
      brand: {
        ...payload.brand,
        scanHint: qrUrl || imageMap.has(POSTER_WXACODE_KEY)
          ? t('routes.poster.scanHint')
          : t('routes.poster.scanHintMpOnly'),
      },
    };

    renderPoster(selectedTemplate.value, surface.ctx, renderPayload, imageMap, canvasHeight);
    if (previewPath.value) revokePosterBlobUrl(previewPath.value);
    const path = await exportPosterCanvas(surface);
    previewPath.value = path;
    emit('generated', path);
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('routes.poster.generateFailed')));
  } finally {
    generating.value = false;
  }
}

function handleClose() {
  emit('close');
}

async function handleRegenerate() {
  await generatePreview();
}

function handleDownload() {
  if (!previewPath.value || !props.route) return;
  const safeName = props.route.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  downloadPosterBlobUrl(previewPath.value, `douxing-${safeName || props.route.id}.png`);
}
</script>
