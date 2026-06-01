<template>
  <view
    v-if="aiPlanLoadingState.active"
    class="ai-plan-overlay"
    :class="themeClass"
    @touchmove.stop.prevent
    @click.stop
  >
    <view class="ai-plan-panel" @click.stop>
      <view class="ai-plan-spinner" />
      <text class="ai-plan-title">{{ aiPlanLoadingState.message }}</text>
      <text class="ai-plan-hint">{{ t('plan.aiPlanningHint') }}</text>
      <text class="ai-plan-tip">{{ t('plan.aiPlanningTip') }}</text>
      <button class="ai-plan-cancel" @click="handleCancel">{{ t('plan.aiPlanningCancel') }}</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { aiPlanLoadingState, cancelAiPlanLoading } from '@/utils/ai-plan-loading';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';

const { t } = useTf();
const { themeClass } = useTheme();

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
  background: var(--dx-surface);
  border-radius: var(--dx-radius-lg);
  padding: 48rpx 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: var(--dx-shadow-md);
}

.ai-plan-spinner {
  width: 72rpx;
  height: 72rpx;
  border: 6rpx solid var(--dx-border);
  border-top-color: var(--dx-primary);
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
  color: var(--dx-text);
  text-align: center;
}

.ai-plan-hint {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: var(--dx-text-secondary);
  text-align: center;
}

.ai-plan-tip {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: var(--dx-text-muted);
  text-align: center;
  line-height: 1.5;
}

.ai-plan-cancel {
  margin-top: 40rpx;
  width: 100%;
  background: var(--dx-surface);
  color: var(--dx-text-secondary);
  border: 1rpx solid var(--dx-border);
  border-radius: var(--dx-radius-sm);
  font-size: 28rpx;
}

.ai-plan-cancel::after {
  border: none;
}
</style>
