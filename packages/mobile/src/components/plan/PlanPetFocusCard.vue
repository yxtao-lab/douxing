<script setup lang="ts">
import type { PlanPetFocusViewModel } from '@douxing/shared';

defineProps<{
  viewModel: PlanPetFocusViewModel;
}>();
</script>

<template>
  <view class="plan-pet-focus">
    <view class="plan-pet-focus__head">
      <view class="plan-pet-focus__avatar" aria-hidden="true">🦊</view>
      <view class="plan-pet-focus__meta">
        <text class="plan-pet-focus__nickname">{{ viewModel.nickname }}</text>
        <text class="plan-pet-focus__personality">{{ viewModel.personalityLabel }}</text>
      </view>
    </view>
    <view class="plan-pet-focus__memory">
      <text class="plan-pet-focus__memory-title">{{ viewModel.memoryTitle }}</text>
      <text v-if="viewModel.hasMemories && viewModel.memorySummary" class="plan-pet-focus__summary">
        {{ viewModel.memorySummary }}
      </text>
      <text v-else-if="!viewModel.hasMemories" class="plan-pet-focus__empty">
        {{ viewModel.emptyMemoryText }}
      </text>
      <view v-if="viewModel.recallItems.length" class="plan-pet-focus__items">
        <view
          v-for="(item, index) in viewModel.recallItems"
          :key="`${item.content}-${index}`"
          class="plan-pet-focus__item"
        >
          <text class="plan-pet-focus__item-content">{{ item.content }}</text>
          <text class="plan-pet-focus__item-reason">{{ item.reason }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.plan-pet-focus {
  margin: 16rpx 24rpx 0;
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.95), rgba(254, 243, 199, 0.85));
  border: 1rpx solid rgba(251, 191, 36, 0.35);
}

.plan-pet-focus__head {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.plan-pet-focus__avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 999rpx;
  background: #fff7ed;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
}

.plan-pet-focus__meta {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.plan-pet-focus__nickname {
  font-size: 30rpx;
  font-weight: 600;
  color: #92400e;
}

.plan-pet-focus__personality {
  font-size: 22rpx;
  color: #b45309;
}

.plan-pet-focus__memory {
  margin-top: 16rpx;
}

.plan-pet-focus__memory-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #78350f;
  margin-bottom: 8rpx;
}

.plan-pet-focus__summary,
.plan-pet-focus__empty {
  display: block;
  font-size: 24rpx;
  line-height: 1.5;
  color: #57534e;
}

.plan-pet-focus__items {
  margin-top: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.plan-pet-focus__item {
  padding: 12rpx 14rpx;
  border-radius: 12rpx;
  background: rgba(255, 255, 255, 0.72);
}

.plan-pet-focus__item-content {
  display: block;
  font-size: 24rpx;
  color: #292524;
}

.plan-pet-focus__item-reason {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: #a8a29e;
}
</style>
