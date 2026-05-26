<template>
  <view class="member-level-icon" :class="[badgeClass, size]">
    <text class="icon">{{ icon }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getMemberLevelBadgeClass, getMemberLevelIcon } from '@douxing/shared';

const props = withDefaults(
  defineProps<{
    level: number;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  { size: 'md' },
);

const icon = computed(() => getMemberLevelIcon(props.level));
const badgeClass = computed(() => getMemberLevelBadgeClass(props.level));
</script>

<style scoped>
.member-level-icon {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
}
.member-level-icon.sm {
  width: 40rpx;
  height: 40rpx;
}
.member-level-icon.sm .icon {
  font-size: 22rpx;
  line-height: 1;
}
.member-level-icon.md {
  width: 72rpx;
  height: 72rpx;
}
.member-level-icon.md .icon {
  font-size: 40rpx;
  line-height: 1;
}
.member-level-icon.lg {
  width: 112rpx;
  height: 112rpx;
  border: 4rpx solid transparent;
}
.member-level-icon.lg .icon {
  font-size: 56rpx;
  line-height: 1;
}
.member-level-icon.free {
  background: #f3f4f6;
  border: 2rpx solid #e5e7eb;
}
.member-level-icon.silver {
  background: linear-gradient(145deg, #f8fafc 0%, #cbd5e1 100%);
  border: 2rpx solid #94a3b8;
}
.member-level-icon.gold {
  background: linear-gradient(145deg, #fef9c3 0%, #fbbf24 100%);
  border: 2rpx solid #f59e0b;
}
.member-level-icon.vip {
  background: linear-gradient(145deg, #ede9fe 0%, #a78bfa 100%);
  border: 2rpx solid #8b5cf6;
}
.member-level-icon.lg.free {
  box-shadow: 0 8rpx 24rpx rgba(107, 114, 128, 0.2);
}
.member-level-icon.lg.silver {
  box-shadow: 0 8rpx 24rpx rgba(100, 116, 139, 0.25);
}
.member-level-icon.lg.gold {
  box-shadow: 0 8rpx 24rpx rgba(245, 158, 11, 0.3);
}
.member-level-icon.lg.vip {
  box-shadow: 0 8rpx 24rpx rgba(139, 92, 246, 0.35);
}
</style>
