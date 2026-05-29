<template>
  <AiPlanBlockingOverlay />
  <view class="tab-bar">
    <view class="tab-bar-border" />
    <view
      v-for="(item, index) in tabList"
      :key="item.pagePath"
      class="tab-bar-item"
      @tap="onSwitch(item.pagePath, index)"
    >
      <text
        class="iconfont tab-icon"
        :class="[item.icon, current === index ? 'is-active' : '']"
      />
      <text class="tab-text" :class="{ 'is-active': current === index }">{{ item.label }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AiPlanBlockingOverlay from '@/components/ai-plan-blocking-overlay/AiPlanBlockingOverlay.vue';
import { isAiPlanLoading } from '@/utils/ai-plan-loading';

interface TabItem {
  pagePath: string;
  labelKey: string;
  icon: string;
}

const props = withDefaults(
  defineProps<{
    current?: number;
  }>(),
  { current: 0 },
);

/** 高亮仅由当前页传入的 current 决定，避免 Tab 页缓存导致选中态错乱 */
const current = computed(() => props.current);

const { t } = useI18n();

const tabDefs: TabItem[] = [
  { pagePath: '/pages/index/index', labelKey: 'tab.home', icon: 'icon-home' },
  { pagePath: '/pages/plan/plan', labelKey: 'tab.plan', icon: 'icon-plan' },
  { pagePath: '/pages/routes/list', labelKey: 'tab.routes', icon: 'icon-routes' },
  { pagePath: '/pages/profile/profile', labelKey: 'tab.profile', icon: 'icon-profile' },
];

const tabList = computed(() =>
  tabDefs.map((item) => ({
    pagePath: item.pagePath,
    icon: item.icon,
    label: t(item.labelKey),
  })),
);

function onSwitch(pagePath: string, index: number) {
  if (current.value === index) return;
  if (isAiPlanLoading()) return;
  uni.switchTab({ url: pagePath });
}
</script>

<style>
@import '@/static/iconfont/iconfont.css';
</style>

<style scoped>
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  min-height: 100rpx;
  padding-bottom: env(safe-area-inset-bottom);
  background: #ffffff;
  box-shadow: 0 -2rpx 16rpx rgba(0, 0, 0, 0.06);
  z-index: 9999;
}

.tab-bar-border {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1rpx;
  background: rgba(0, 0, 0, 0.08);
  transform: scaleY(0.5);
}

.tab-bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12rpx 0 16rpx;
}

.tab-icon {
  font-size: 44rpx;
  color: var(--dx-text-secondary);
}

.tab-icon.is-active {
  color: var(--dx-primary);
}

.tab-text {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--dx-text-secondary);
}

.tab-text.is-active {
  color: var(--dx-primary);
  font-weight: 500;
}
</style>
