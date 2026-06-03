<template>
  <view class="theme-row">
    <text class="theme-label">{{ t('routes.poster.options.themeLabel') }}</text>
    <scroll-view scroll-x class="chip-scroll" :show-scrollbar="false">
      <view class="chip-row">
        <view
          v-for="preset in themePresets"
          :key="preset.id"
          class="option-chip"
          :class="{ active: modelValue === preset.id, disabled }"
          @click="selectPreset(preset.id)"
        >
          <view class="color-dot" :style="{ background: preset.sampleColor }" />
          <text>{{ t(preset.labelKey) }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { useTf } from '@/i18n/useTf';
import type { PosterThemePresetId } from '@/poster/types';
import { POSTER_THEME_PRESETS } from '@/poster/poster-options';

const props = defineProps<{
  modelValue: PosterThemePresetId;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [PosterThemePresetId];
}>();

const { t } = useTf();

const themePresets = [
  { id: 'forest' as PosterThemePresetId, labelKey: 'routes.poster.options.themeForest', sampleColor: POSTER_THEME_PRESETS.forest.colors[0] },
  { id: 'ocean' as PosterThemePresetId, labelKey: 'routes.poster.options.themeOcean', sampleColor: POSTER_THEME_PRESETS.ocean.colors[0] },
  { id: 'sunset' as PosterThemePresetId, labelKey: 'routes.poster.options.themeSunset', sampleColor: POSTER_THEME_PRESETS.sunset.colors[0] },
  { id: 'classic' as PosterThemePresetId, labelKey: 'routes.poster.options.themeClassic', sampleColor: POSTER_THEME_PRESETS.classic.colors[0] },
];

function selectPreset(id: PosterThemePresetId) {
  if (props.disabled || props.modelValue === id) return;
  emit('update:modelValue', id);
}
</script>

<style scoped>
.theme-row {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.theme-label {
  font-size: 22rpx;
  color: var(--dx-text-secondary);
}
.chip-scroll {
  width: 100%;
  white-space: nowrap;
}
.chip-row {
  display: inline-flex;
  gap: 12rpx;
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
.option-chip.active {
  border-color: var(--dx-primary);
  background: var(--dx-primary-light);
  color: var(--dx-primary);
}
.option-chip.disabled {
  opacity: 0.55;
}
.color-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
