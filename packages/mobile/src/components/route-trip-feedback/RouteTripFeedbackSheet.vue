<template>
  <view v-if="visible" class="tf-mask" @click="handleClose">
    <view class="tf-sheet" @click.stop>
      <view class="tf-header">
        <text class="tf-title">{{ t('routes.tripFeedbackTitle') }}</text>
        <text class="tf-close" @click="handleClose">×</text>
      </view>

      <text class="tf-hint">{{ t('routes.tripFeedbackHint') }}</text>

      <view v-if="loading" class="tf-status">
        <text>{{ t('routes.tripFeedbackLoading') }}</text>
      </view>

      <view v-else-if="errorText" class="tf-error">
        <text>{{ errorText }}</text>
      </view>

      <scroll-view v-else-if="feedback" scroll-y class="tf-body" :show-scrollbar="true">
        <text class="tf-summary">{{ feedback.diff.summaryText }}</text>

        <text class="tf-section">{{ t('routes.tripFeedbackVisited') }}</text>
        <view v-if="feedback.diff.visited.length === 0" class="tf-empty">
          <text>{{ t('routes.tripFeedbackVisitedEmpty') }}</text>
        </view>
        <view
          v-for="(item, index) in feedback.diff.visited"
          :key="`v-${item.name}-${index}`"
          class="tf-poi tf-poi--visited"
        >
          <text class="tf-poi-name">{{ item.name }}</text>
        </view>

        <text class="tf-section">{{ t('routes.tripFeedbackSkipped') }}</text>
        <view v-if="feedback.diff.skipped.length === 0" class="tf-empty">
          <text>{{ t('routes.tripFeedbackSkippedEmpty') }}</text>
        </view>
        <view
          v-for="(item, index) in feedback.diff.skipped"
          :key="`s-${item.name}-${index}`"
          class="tf-poi tf-poi--skipped"
        >
          <text class="tf-poi-name">{{ item.name }}</text>
        </view>

        <view v-if="feedback.diff.rating.averageRating != null" class="tf-rating">
          <text>
            {{
              tf('routes.tripFeedbackRating', {
                score: String(feedback.diff.rating.averageRating),
                count: String(feedback.diff.rating.ratedCount),
              })
            }}
          </text>
        </view>

        <view v-if="isFinalized" class="tf-done">
          <text>{{ t('routes.tripFeedbackFinalized') }}</text>
        </view>
      </scroll-view>

      <view class="tf-actions">
        <button class="btn-tf-cancel" @click="handleClose">{{ t('routes.tripFeedbackClose') }}</button>
        <button
          v-if="feedback && !isFinalized"
          class="btn-tf-finalize"
          :loading="finalizing"
          @click="handleFinalize"
        >
          {{ t('routes.tripFeedbackFinalize') }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { TripFeedbackStatus, type TripFeedbackInfo } from '@douxing/shared';
import {
  finalizeRouteTripFeedback,
  getRouteTripFeedback,
  previewRouteTripFeedback,
} from '@/api/routes';
import { getAppErrorMessage } from '@/utils/request';
import { useTf } from '@/i18n/useTf';

const props = defineProps<{
  visible: boolean;
  routeId: number;
}>();

const emit = defineEmits<{
  close: [];
  finalized: [];
}>();

const { tf, t } = useTf();

const loading = ref(false);
const finalizing = ref(false);
const errorText = ref('');
const feedback = ref<TripFeedbackInfo | null>(null);

const isFinalized = computed(
  () => feedback.value?.status === TripFeedbackStatus.FINALIZED,
);

/**
 * 加载已确认复盘，若无则拉取预览。
 */
async function loadFeedback() {
  if (!props.visible || !props.routeId) return;
  loading.value = true;
  errorText.value = '';
  feedback.value = null;

  try {
    const saved = await getRouteTripFeedback(props.routeId);
    if (saved?.status === TripFeedbackStatus.FINALIZED) {
      feedback.value = saved;
    } else {
      feedback.value = await previewRouteTripFeedback(props.routeId);
    }
  } catch (err) {
    errorText.value = getAppErrorMessage(err, t('routes.tripFeedbackLoadFailed'));
  } finally {
    loading.value = false;
  }
}

/**
 * 确认复盘并回流。
 */
async function handleFinalize() {
  if (!feedback.value || isFinalized.value) return;
  finalizing.value = true;
  try {
    feedback.value = await finalizeRouteTripFeedback(props.routeId);
    uni.showToast({ title: t('routes.tripFeedbackFinalizeSuccess'), icon: 'success' });
    emit('finalized');
  } catch (err) {
    uni.showToast({
      title: getAppErrorMessage(err, t('routes.tripFeedbackFinalizeFailed')),
      icon: 'none',
    });
  } finally {
    finalizing.value = false;
  }
}

/**
 * 关闭弹层。
 */
function handleClose() {
  emit('close');
}

watch(
  () => props.visible,
  (v) => {
    if (v) void loadFeedback();
  },
);
</script>

<style scoped>
.tf-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.tf-sheet {
  width: 100%;
  max-height: 85vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.tf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tf-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #1a1a1a;
}
.tf-close {
  font-size: 44rpx;
  color: #999;
  line-height: 1;
}
.tf-hint,
.tf-status,
.tf-empty,
.tf-done {
  font-size: 24rpx;
  color: #888;
}
.tf-error {
  font-size: 26rpx;
  color: #c0392b;
}
.tf-body {
  max-height: 52vh;
  flex: 1;
}
.tf-summary {
  display: block;
  font-size: 26rpx;
  color: #333;
  line-height: 1.5;
  margin-bottom: 16rpx;
}
.tf-section {
  display: block;
  margin-top: 20rpx;
  margin-bottom: 8rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #222;
}
.tf-poi {
  padding: 12rpx 0;
  border-bottom: 1px solid #f0f0f0;
}
.tf-poi-name {
  font-size: 28rpx;
  color: #333;
}
.tf-poi--skipped .tf-poi-name {
  color: #a05a00;
}
.tf-rating {
  margin-top: 20rpx;
  font-size: 26rpx;
  color: #555;
}
.tf-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 8rpx;
}
.btn-tf-cancel,
.btn-tf-finalize {
  flex: 1;
  font-size: 28rpx;
  border-radius: 12rpx;
}
.btn-tf-cancel {
  background: #f5f5f5;
  color: #666;
}
.btn-tf-finalize {
  background: #1a7f6e;
  color: #fff;
}
</style>
