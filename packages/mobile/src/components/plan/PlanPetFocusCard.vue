<script setup lang="ts">
import type { PlanPetFocusViewModel } from '@douxing/shared';

defineProps<{
  viewModel: PlanPetFocusViewModel;
}>();
</script>

<template>
  <view class="plan-pet-focus">
    <view class="plan-pet-focus__avatar" aria-hidden="true">🦊</view>
    <view class="plan-pet-focus__meta">
      <text class="plan-pet-focus__nickname">{{ viewModel.nickname }}</text>
      <text class="plan-pet-focus__personality">{{ viewModel.personalityLabel }}</text>
      <text v-if="viewModel.hasMemories" class="plan-pet-focus__hint">
        {{ viewModel.memoryAppliedHint }}
      </text>
      <text v-else class="plan-pet-focus__hint plan-pet-focus__hint--muted">
        {{ viewModel.emptyMemoryText }}
      </text>
    </view>
  </view>
</template>

<style scoped>
.plan-pet-focus {
  margin: 16rpx 24rpx 0;
  padding: 16rpx 20rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.95), rgba(254, 243, 199, 0.85));
  border: 1rpx solid rgba(251, 191, 36, 0.35);
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.plan-pet-focus__avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 999rpx;
  background: #fff7ed;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  flex-shrink: 0;
}

.plan-pet-focus__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.plan-pet-focus__nickname {
  font-size: 28rpx;
  font-weight: 600;
  color: #92400e;
}

.plan-pet-focus__personality {
  font-size: 22rpx;
  color: #b45309;
}

.plan-pet-focus__hint {
  font-size: 22rpx;
  line-height: 1.4;
  color: #78716c;
}

.plan-pet-focus__hint--muted {
  color: #a8a29e;
}
</style>
