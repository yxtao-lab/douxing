<template>
  <view
    v-if="aiPlanLoadingState.active"
    class="ai-plan-overlay"
    @touchmove.stop.prevent
    @click.stop
  >
    <view class="ai-plan-panel" @click.stop>
      <view class="ai-plan-spinner" />
      <text class="ai-plan-title">{{ aiPlanLoadingState.message }}</text>
      <text class="ai-plan-hint">正在调用 AI 生成行程，请稍候</text>
      <text class="ai-plan-tip">期间无法切换页面或进行其他操作</text>
      <button class="ai-plan-cancel" @click="handleCancel">取消规划</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { aiPlanLoadingState, cancelAiPlanLoading } from '@/utils/ai-plan-loading';

function handleCancel() {
  cancelAiPlanLoading();
}
</script>

<style scoped>
.ai-plan-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100000;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  box-sizing: border-box;
}

.ai-plan-panel {
  width: 100%;
  max-width: 560rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.12);
}

.ai-plan-spinner {
  width: 72rpx;
  height: 72rpx;
  border: 6rpx solid #e5e7eb;
  border-top-color: #1677ff;
  border-radius: 50%;
  animation: ai-plan-spin 0.9s linear infinite;
}

@keyframes ai-plan-spin {
  to {
    transform: rotate(360deg);
  }
}

.ai-plan-title {
  margin-top: 32rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
  text-align: center;
}

.ai-plan-hint {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #6b7280;
  text-align: center;
}

.ai-plan-tip {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #9ca3af;
  text-align: center;
  line-height: 1.5;
}

.ai-plan-cancel {
  margin-top: 40rpx;
  width: 100%;
  background: #fff;
  color: #6b7280;
  border: 1rpx solid #d1d5db;
  border-radius: 12rpx;
  font-size: 28rpx;
}

.ai-plan-cancel::after {
  border: none;
}
</style>
