<template>
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
      <text class="tab-text" :class="{ 'is-active': current === index }">{{ item.text }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface TabItem {
  pagePath: string;
  text: string;
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

const tabList: TabItem[] = [
  { pagePath: '/pages/index/index', text: '首页', icon: 'icon-home' },
  { pagePath: '/pages/plan/plan', text: '规划', icon: 'icon-plan' },
  { pagePath: '/pages/routes/list', text: '路线', icon: 'icon-routes' },
  { pagePath: '/pages/profile/profile', text: '我的', icon: 'icon-profile' },
];

function onSwitch(pagePath: string, index: number) {
  if (current.value === index) return;
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
  color: #6b7280;
}

.tab-icon.is-active {
  color: #1677ff;
}

.tab-text {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #6b7280;
}

.tab-text.is-active {
  color: #1677ff;
  font-weight: 500;
}
</style>
