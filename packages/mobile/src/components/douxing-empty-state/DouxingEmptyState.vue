<template>
  <view class="dx-empty" :class="rootClass">
    <template v-if="loading">
      <view class="dx-empty-art dx-empty-art--loading">
        <view class="dx-empty-spinner" />
      </view>
      <text class="dx-empty-title">{{ loadingText || t('common.loading') }}</text>
    </template>
    <template v-else>
      <view class="dx-empty-art" :class="'dx-empty-art--' + variant">
        <text class="dx-empty-emoji">{{ displayIcon }}</text>
      </view>
      <text class="dx-empty-title">{{ title }}</text>
      <text v-if="description" class="dx-empty-desc">{{ description }}</text>
      <view v-if="hints.length > 0" class="dx-empty-hints">
        <text v-for="(hint, index) in hints" :key="index" class="dx-empty-hint">{{ hint }}</text>
      </view>
      <view v-if="actionLabel || secondaryActionLabel" class="dx-empty-actions">
        <button
          v-if="actionLabel"
          class="dx-empty-btn dx-empty-btn--primary"
          @click="emit('action')"
        >
          {{ actionLabel }}
        </button>
        <button
          v-if="secondaryActionLabel"
          class="dx-empty-btn dx-empty-btn--ghost"
          @click="emit('secondaryAction')"
        >
          {{ secondaryActionLabel }}
        </button>
      </view>
      <slot />
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTf } from '@/i18n/useTf';
import {
  getEmptyStateIcon,
  type DouxingEmptyVariant,
} from './empty-state-variants';

const props = withDefaults(
  defineProps<{
    variant?: DouxingEmptyVariant;
    icon?: string;
    title?: string;
    description?: string;
    hints?: string[];
    actionLabel?: string;
    secondaryActionLabel?: string;
    loading?: boolean;
    loadingText?: string;
    compact?: boolean;
    embedded?: boolean;
  }>(),
  {
    variant: 'generic',
    title: '',
    hints: () => [],
    loading: false,
    compact: false,
    embedded: false,
  },
);

const emit = defineEmits<{
  action: [];
  secondaryAction: [];
}>();

const { t } = useTf();

const displayIcon = computed(() => getEmptyStateIcon(props.variant, props.icon));

const rootClass = computed(() => ({
  'dx-empty--compact': props.compact,
  'dx-empty--embedded': props.embedded,
}));
</script>

<style scoped>
.dx-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 72rpx 40rpx;
  box-sizing: border-box;
}

.dx-empty--compact {
  padding: 48rpx 32rpx;
}

.dx-empty--embedded {
  padding: 32rpx 24rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  box-shadow: var(--dx-shadow-sm);
}

.dx-empty-art {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28rpx;
  background: var(--dx-gradient-soft);
  border: 2rpx solid var(--dx-primary-light);
}

.dx-empty--compact .dx-empty-art {
  width: 120rpx;
  height: 120rpx;
  margin-bottom: 20rpx;
}

.dx-empty-art--loading {
  background: var(--dx-primary-light);
  border-color: transparent;
}

.dx-empty-art--error {
  background: #fff2f0;
  border-color: #ffccc7;
}

.dx-empty-art--plaza,
.dx-empty-art--favorites {
  background: linear-gradient(145deg, var(--dx-accent-soft) 0%, var(--dx-primary-light) 100%);
}

.dx-empty-emoji {
  font-size: 72rpx;
  line-height: 1;
}

.dx-empty--compact .dx-empty-emoji {
  font-size: 56rpx;
}

.dx-empty-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid rgba(22, 119, 255, 0.15);
  border-top-color: var(--dx-primary);
  border-radius: 50%;
  animation: dx-empty-spin 0.8s linear infinite;
}

@keyframes dx-empty-spin {
  to {
    transform: rotate(360deg);
  }
}

.dx-empty-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--dx-text);
  line-height: 1.45;
  max-width: 560rpx;
}

.dx-empty-desc {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: var(--dx-text-secondary);
  line-height: 1.5;
  max-width: 560rpx;
}

.dx-empty-hints {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  max-width: 560rpx;
}

.dx-empty-hint {
  font-size: 24rpx;
  color: var(--dx-text-muted);
  line-height: 1.45;
}

.dx-empty-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  margin-top: 32rpx;
  width: 100%;
  max-width: 400rpx;
}

.dx-empty--compact .dx-empty-actions {
  margin-top: 24rpx;
}

.dx-empty-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
  font-weight: 600;
  border-radius: var(--dx-radius-md);
  border: none;
}

.dx-empty-btn::after {
  border: none;
}

.dx-empty-btn--primary {
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
}

.dx-empty-btn--ghost {
  background: var(--dx-surface);
  color: var(--dx-primary);
  border: 2rpx solid var(--dx-primary-light);
}
</style>
