<template>
  <view v-if="visible" class="missed-mask" @click="handleClose">
    <view class="missed-sheet" @click.stop>
      <view class="missed-header">
        <text class="missed-title">{{ t('routes.missedSheetTitle') }}</text>
        <text class="missed-close" @click="handleClose">×</text>
      </view>

      <text class="missed-hint">{{ t('routes.missedSheetHint') }}</text>

      <view v-if="loading" class="missed-status">
        <text>{{ t('routes.missedLoading') }}</text>
      </view>

      <view v-else-if="errorText" class="missed-error">
        <text>{{ errorText }}</text>
      </view>

      <scroll-view v-else scroll-y class="missed-body" :show-scrollbar="true">
        <view v-if="analysis && analysis.missed.length === 0" class="missed-empty">
          <text>{{ t('routes.missedEmpty') }}</text>
        </view>

        <template v-else-if="analysis">
          <text class="missed-section-title">{{ t('routes.missedListTitle') }}</text>
          <view
            v-for="(item, index) in analysis.missed"
            :key="`${item.name}-${index}`"
            class="missed-poi"
          >
            <view class="missed-poi-main">
              <text class="missed-poi-name">{{ item.name }}</text>
              <text v-if="item.time" class="missed-poi-time">{{ item.time }}</text>
            </view>
            <text v-if="item.dayTitle" class="missed-poi-day">{{ item.dayTitle }}</text>
          </view>

          <view v-if="analysis.alternatives.length > 0" class="missed-alt-block">
            <text class="missed-section-title">{{ t('routes.missedAltTitle') }}</text>
            <view
              v-for="alt in analysis.alternatives"
              :key="`${alt.forMissedPoi}-${alt.id}`"
              class="missed-alt"
            >
              <text class="missed-alt-name">{{ alt.name }}</text>
              <text class="missed-alt-for">
                {{ tf('routes.missedAltFor', { name: alt.forMissedPoi }) }}
              </text>
            </view>
          </view>
        </template>
      </scroll-view>

      <view class="missed-actions">
        <button class="btn-missed-cancel" @click="handleClose">{{ t('routes.missedCancel') }}</button>
        <button
          v-if="analysis && analysis.missed.length > 0"
          class="btn-missed-record"
          :loading="recording"
          @click="handleRecord"
        >
          {{ t('routes.missedRecord') }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { RouteMissedPoiAnalyzeResponse } from '@douxing/shared';
import { analyzeRouteMissedPois, recordRouteMissedPois } from '@/api/routes';
import { getAppErrorMessage } from '@/utils/request';
import { useTf } from '@/i18n/useTf';

const props = defineProps<{
  visible: boolean;
  routeId: number;
  dayIndex: number;
}>();

const emit = defineEmits<{
  close: [];
  recorded: [];
}>();

const { tf, t } = useTf();

const loading = ref(false);
const recording = ref(false);
const errorText = ref('');
const analysis = ref<RouteMissedPoiAnalyzeResponse | null>(null);

async function loadAnalysis() {
  if (!props.visible || !props.routeId) return;
  loading.value = true;
  errorText.value = '';
  analysis.value = null;

  try {
    analysis.value = await analyzeRouteMissedPois(props.routeId, {
      dayIndex: props.dayIndex,
    });
  } catch (err) {
    errorText.value = getAppErrorMessage(err, t('routes.missedAnalyzeFailed'));
  } finally {
    loading.value = false;
  }
}

async function handleRecord() {
  if (!analysis.value || analysis.value.missed.length === 0) return;
  recording.value = true;
  try {
    await recordRouteMissedPois(props.routeId, {
      items: analysis.value.missed.map((m) => ({ name: m.name, dayIndex: m.dayIndex })),
    });
    uni.showToast({ title: t('routes.missedRecordSuccess'), icon: 'success' });
    emit('recorded');
    emit('close');
  } catch (err) {
    uni.showToast({
      title: getAppErrorMessage(err, t('routes.missedRecordFailed')),
      icon: 'none',
    });
  } finally {
    recording.value = false;
  }
}

function handleClose() {
  if (recording.value) return;
  emit('close');
}

watch(
  () => [props.visible, props.routeId, props.dayIndex] as const,
  ([visible]) => {
    if (visible) void loadAnalysis();
  },
);
</script>

<style scoped>
.missed-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
}

.missed-sheet {
  width: 100%;
  max-height: 82vh;
  background: var(--dx-bg, #fff);
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.missed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.missed-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--dx-text, #1a1a1a);
}

.missed-close {
  font-size: 44rpx;
  line-height: 1;
  color: var(--dx-muted, #888);
  padding: 8rpx;
}

.missed-hint {
  font-size: 26rpx;
  color: var(--dx-muted, #666);
  line-height: 1.5;
}

.missed-status,
.missed-error,
.missed-empty {
  padding: 24rpx 0;
  font-size: 28rpx;
  color: var(--dx-muted, #666);
}

.missed-error {
  color: #c0392b;
}

.missed-body {
  max-height: 48vh;
}

.missed-section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  margin: 12rpx 0;
  color: var(--dx-text, #1a1a1a);
}

.missed-poi {
  padding: 14rpx 0;
  border-bottom: 1px solid var(--dx-border, #eee);
}

.missed-poi-name {
  font-size: 28rpx;
  color: var(--dx-text, #1a1a1a);
}

.missed-poi-time {
  font-size: 24rpx;
  color: #c0392b;
  margin-left: 12rpx;
}

.missed-poi-day {
  display: block;
  font-size: 24rpx;
  color: var(--dx-muted, #888);
  margin-top: 6rpx;
}

.missed-alt {
  padding: 12rpx 0;
  border-bottom: 1px dashed var(--dx-border, #eee);
}

.missed-alt-name {
  font-size: 28rpx;
  color: var(--dx-primary, #2563eb);
}

.missed-alt-for {
  display: block;
  font-size: 24rpx;
  color: var(--dx-muted, #666);
  margin-top: 4rpx;
}

.missed-actions {
  display: flex;
  gap: 16rpx;
}

.btn-missed-cancel,
.btn-missed-record {
  flex: 1;
  font-size: 28rpx;
  border-radius: 999rpx;
}

.btn-missed-cancel {
  background: var(--dx-bg-soft, #f3f4f6);
  color: var(--dx-text, #333);
}

.btn-missed-record {
  background: var(--dx-primary, #2563eb);
  color: #fff;
}
</style>
