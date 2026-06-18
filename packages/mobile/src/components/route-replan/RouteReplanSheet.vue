<template>
  <view v-if="visible" class="replan-mask" @click="handleClose">
    <view class="replan-sheet" @click.stop>
      <view class="replan-header">
        <text class="replan-title">{{ t('routes.replanSheetTitle') }}</text>
        <text class="replan-close" @click="handleClose">×</text>
      </view>

      <text class="replan-hint">{{ t('routes.replanSheetHint') }}</text>

      <view v-if="loading" class="replan-status">
        <text>{{ statusText }}</text>
      </view>

      <view v-else-if="errorText" class="replan-error">
        <text>{{ errorText }}</text>
      </view>

      <scroll-view v-else-if="preview" scroll-y class="replan-body" :show-scrollbar="true">
        <view v-if="!canApply" class="replan-published-hint">
          <text>{{ t('routes.replanPublishedHint') }}</text>
        </view>

        <text class="replan-section-title">{{ t('routes.replanSegmentTitle') }}</text>
        <view v-for="(spot, index) in preview.segment.attractions" :key="`${spot.name}-${index}`" class="replan-poi">
          <text class="replan-poi-name">{{ spot.name }}</text>
          <text v-if="spot.time" class="replan-poi-time">{{ spot.time }}</text>
        </view>

        <view v-if="preview.diff.reordered.length > 0" class="replan-diff">
          <text class="replan-section-title">{{ t('routes.replanDiffTitle') }}</text>
          <text
            v-for="item in preview.diff.reordered"
            :key="item.name"
            class="replan-diff-item"
          >
            {{ tf('routes.replanDiffItem', { name: item.name, prev: item.previousOrder + 1, next: item.newOrder + 1 }) }}
          </text>
        </view>

        <view v-if="preview.segment.warnings.length > 0" class="replan-warnings">
          <text v-for="(warning, wi) in preview.segment.warnings" :key="wi" class="replan-warning">
            {{ warning }}
          </text>
        </view>
      </scroll-view>

      <view class="replan-actions">
        <button class="btn-replan-cancel" @click="handleClose">{{ t('routes.replanCancel') }}</button>
        <button
          v-if="preview && canApply"
          class="btn-replan-confirm"
          :loading="applying"
          @click="handleApply"
        >
          {{ t('routes.replanConfirm') }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { RouteReplanContextInput, RouteReplanPreviewResponse } from '@douxing/shared';
import { applyRouteReplan, previewRouteReplan } from '@/api/routes';
import { getCurrentLocation } from '@/utils/location';
import { getAppErrorMessage } from '@/utils/request';
import { useTf } from '@/i18n/useTf';

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

const { t, tf } = useTf();

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

async function loadPreview() {
  if (!props.visible || !props.routeId) return;
  loading.value = true;
  locating.value = true;
  errorText.value = '';
  preview.value = null;
  canApply.value = false;
  lastContext.value = null;

  try {
    const location = await getCurrentLocation();
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
      err instanceof Error && err.message.includes('location')
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
    uni.showToast({ title: t('routes.replanApplySuccess'), icon: 'success' });
    emit('applied');
    emit('close');
  } catch (err) {
    uni.showToast({
      title: getAppErrorMessage(err, t('routes.replanApplyFailed')),
      icon: 'none',
    });
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

<style scoped>
.replan-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
}

.replan-sheet {
  width: 100%;
  max-height: 82vh;
  background: var(--dx-card-bg, #fff);
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.replan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.replan-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--dx-text, #1a1a1a);
}

.replan-close {
  font-size: 44rpx;
  line-height: 1;
  color: var(--dx-muted, #888);
  padding: 8rpx 12rpx;
}

.replan-hint {
  font-size: 26rpx;
  color: var(--dx-muted, #666);
  line-height: 1.5;
}

.replan-status,
.replan-error {
  padding: 24rpx 0;
  font-size: 28rpx;
  color: var(--dx-muted, #666);
}

.replan-error {
  color: #c0392b;
}

.replan-body {
  max-height: 48vh;
}

.replan-published-hint {
  background: rgba(255, 193, 7, 0.12);
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
}

.replan-published-hint text {
  font-size: 24rpx;
  color: #9a6700;
  line-height: 1.5;
}

.replan-section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  margin: 12rpx 0;
  color: var(--dx-text, #1a1a1a);
}

.replan-poi {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  padding: 14rpx 0;
  border-bottom: 1px solid var(--dx-border, #eee);
}

.replan-poi-name {
  font-size: 28rpx;
  color: var(--dx-text, #1a1a1a);
}

.replan-poi-time {
  font-size: 24rpx;
  color: var(--dx-primary, #2563eb);
}

.replan-diff-item,
.replan-warning {
  display: block;
  font-size: 24rpx;
  color: var(--dx-muted, #666);
  line-height: 1.6;
  margin-bottom: 8rpx;
}

.replan-actions {
  display: flex;
  gap: 16rpx;
}

.btn-replan-cancel,
.btn-replan-confirm {
  flex: 1;
  font-size: 28rpx;
  border-radius: 999rpx;
}

.btn-replan-cancel {
  background: var(--dx-bg-soft, #f3f4f6);
  color: var(--dx-text, #333);
}

.btn-replan-confirm {
  background: var(--dx-primary, #2563eb);
  color: #fff;
}
</style>
