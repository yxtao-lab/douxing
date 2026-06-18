<template>
  <view v-if="visible" class="intrip-mask" @click="handleClose">
    <view class="intrip-sheet" @click.stop>
      <view class="intrip-header">
        <text class="intrip-title">{{ titleText }}</text>
        <text class="intrip-close" @click="handleClose">×</text>
      </view>

      <view v-if="loading" class="intrip-status">
        <text>{{ analyzingText }}</text>
      </view>

      <view v-else-if="errorText" class="intrip-error">
        <text>{{ errorText }}</text>
      </view>

      <scroll-view v-else-if="result" scroll-y class="intrip-body" :show-scrollbar="true">
        <text class="intrip-section">{{ insightTitle }}</text>
        <text class="intrip-insight">{{ result.insight }}</text>
        <text class="intrip-section">{{ replyTitle }}</text>
        <text class="intrip-reply">{{ result.petReply }}</text>
      </scroll-view>

      <view class="intrip-actions">
        <button class="btn-intrip-close" @click="handleClose">{{ closeText }}</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PetAnalyzeResult } from '@douxing/shared';
import {
  formatPetMemoryWallAnalyzeInTrip,
  formatPetMemoryWallAnalyzing,
  formatPetMemoryWallInsightTitle,
  formatPetMemoryWallPetReplyTitle,
} from '@douxing/shared';
import { analyzeTravelPet } from '@/api/pets';
import { getAppErrorMessage } from '@/utils/request';
import { useTf } from '@/i18n/useTf';

const props = defineProps<{
  visible: boolean;
  routeId: number;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { tf, locale, t } = useTf();

const loading = ref(false);
const errorText = ref('');
const result = ref<PetAnalyzeResult | null>(null);

const titleText = computed(() => formatPetMemoryWallAnalyzeInTrip(locale.value));
const analyzingText = computed(() => formatPetMemoryWallAnalyzing(locale.value));
const insightTitle = computed(() => formatPetMemoryWallInsightTitle(locale.value));
const replyTitle = computed(() => formatPetMemoryWallPetReplyTitle(locale.value));
const closeText = computed(() => t('routes.missedCancel'));

async function loadAnalyze() {
  if (!props.visible || !props.routeId) return;
  loading.value = true;
  errorText.value = '';
  result.value = null;
  try {
    result.value = await analyzeTravelPet({ scene: 'in_trip', routeId: props.routeId });
  } catch (err) {
    errorText.value = getAppErrorMessage(err, t('routes.inTripAnalyzeFailed'));
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  emit('close');
}

watch(
  () => [props.visible, props.routeId] as const,
  ([visible]) => {
    if (visible) void loadAnalyze();
  },
);
</script>

<style scoped>
.intrip-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
}

.intrip-sheet {
  width: 100%;
  max-height: 70vh;
  background: var(--dx-bg, #fff);
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.intrip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.intrip-title {
  font-size: 34rpx;
  font-weight: 600;
}

.intrip-close {
  font-size: 44rpx;
  color: var(--dx-muted, #888);
}

.intrip-status,
.intrip-error {
  padding: 24rpx 0;
  font-size: 28rpx;
  color: var(--dx-muted, #666);
}

.intrip-error {
  color: #c0392b;
}

.intrip-body {
  max-height: 40vh;
}

.intrip-section {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  margin: 8rpx 0;
}

.intrip-insight,
.intrip-reply {
  display: block;
  font-size: 28rpx;
  line-height: 1.6;
  color: var(--dx-muted, #666);
  margin-bottom: 16rpx;
}

.intrip-actions {
  margin-top: 8rpx;
}

.btn-intrip-close {
  width: 100%;
  font-size: 28rpx;
  border-radius: 999rpx;
  background: var(--dx-bg-soft, #f3f4f6);
}
</style>
