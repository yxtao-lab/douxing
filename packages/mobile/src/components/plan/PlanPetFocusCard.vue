<script setup lang="ts">
import type { PlanPetFocusViewModel } from '@douxing/shared';

withDefaults(
  defineProps<{
    viewModel: PlanPetFocusViewModel;
    /** 会话进行中时单行紧凑展示，减少对聊天区的挤压 */
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);
</script>

<template>
  <view class="plan-pet-focus" :class="{ 'plan-pet-focus--compact': compact }">
    <view class="plan-pet-focus__avatar" aria-hidden="true">{{ viewModel.speciesEmoji }}</view>
    <view class="plan-pet-focus__meta">
      <view class="plan-pet-focus__title-row">
        <text class="plan-pet-focus__nickname">{{ viewModel.nickname }}</text>
        <text class="plan-pet-focus__personality">· {{ viewModel.personalityLabel }}</text>
      </view>
      <template v-if="!compact">
        <text v-if="viewModel.hasMemories" class="plan-pet-focus__hint">
          {{ viewModel.memoryAppliedHint }}
        </text>
        <text v-else class="plan-pet-focus__hint plan-pet-focus__hint--muted">
          {{ viewModel.emptyMemoryText }}
        </text>
      </template>
    </view>
  </view>
</template>

<style scoped>
.plan-pet-focus {
  margin: 12rpx 0 0;
  padding: 16rpx 20rpx;
  border-radius: var(--dx-radius-md, 16rpx);
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.95), rgba(254, 243, 199, 0.85));
  border: 1rpx solid rgba(251, 191, 36, 0.35);
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.plan-pet-focus--compact {
  margin-top: 8rpx;
  padding: 8rpx 14rpx;
  gap: 10rpx;
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

.plan-pet-focus--compact .plan-pet-focus__avatar {
  width: 40rpx;
  height: 40rpx;
  font-size: 24rpx;
}

.plan-pet-focus__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.plan-pet-focus--compact .plan-pet-focus__meta {
  gap: 0;
}

.plan-pet-focus__title-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8rpx;
  min-width: 0;
}

.plan-pet-focus__nickname {
  font-size: 28rpx;
  font-weight: 600;
  color: #92400e;
}

.plan-pet-focus--compact .plan-pet-focus__nickname {
  font-size: 24rpx;
}

.plan-pet-focus__personality {
  font-size: 22rpx;
  color: #b45309;
}

.plan-pet-focus--compact .plan-pet-focus__personality {
  font-size: 20rpx;
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
