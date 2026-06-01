<template>
  <scroll-view
    v-if="days.length > 1"
    class="route-day-tabs"
    scroll-x
    enable-flex
    :show-scrollbar="false"
  >
    <view
      v-for="(day, index) in days"
      :key="index"
      class="route-day-tab"
      :class="{ active: index === activeDayIndex }"
      @click="selectDay(index)"
    >
      <text>{{ dayTabLabel(day, index) }}</text>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
import type { RouteDayPlan } from '@douxing/shared';
import { useTf } from '@/i18n/useTf';

defineProps<{
  days: RouteDayPlan[];
  activeDayIndex: number;
}>();

const emit = defineEmits<{
  'update:activeDayIndex': [index: number];
}>();

const { tf } = useTf();

function dayTabLabel(day: RouteDayPlan, index: number): string {
  if (day.date?.trim()) return day.date;
  return tf('routes.flowDayTab', { day: index + 1 });
}

function selectDay(index: number) {
  emit('update:activeDayIndex', index);
}
</script>

<style scoped>
.route-day-tabs {
  display: flex;
  flex-direction: row;
  white-space: nowrap;
  margin-bottom: 20rpx;
}

.route-day-tab {
  display: inline-flex;
  flex-shrink: 0;
  padding: 12rpx 28rpx;
  margin-right: 16rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 24rpx;
}

.route-day-tab.active {
  background: var(--dx-primary-light);
  color: var(--dx-primary);
  font-weight: 600;
}
</style>
