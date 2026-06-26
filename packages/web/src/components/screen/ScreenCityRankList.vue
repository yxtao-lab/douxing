<template>
  <ul class="screen-city-rank">
    <li v-for="(item, index) in items" :key="item.cityCode" class="screen-city-rank__item">
      <span class="screen-city-rank__rank" :class="{ top3: index < 3 }">{{ index + 1 }}</span>
      <span class="screen-city-rank__name">{{ item.cityName }}</span>
      <span class="screen-city-rank__bar-wrap">
        <span class="screen-city-rank__bar" :style="{ width: barWidth(item.checkinCount) }" />
      </span>
      <span class="screen-city-rank__count">{{ item.checkinCount }}</span>
    </li>
    <li v-if="items.length === 0" class="screen-city-rank__empty">{{ emptyLabel }}</li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AnalyticsCityGeoStat } from '@douxing/shared';

const props = defineProps<{
  items: AnalyticsCityGeoStat[];
  emptyLabel: string;
}>();

const maxCount = computed(() => Math.max(1, ...props.items.map((item) => item.checkinCount)));

function barWidth(count: number) {
  return `${Math.round((count / maxCount.value) * 100)}%`;
}
</script>

<style scoped>
.screen-city-rank {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.screen-city-rank__item {
  display: grid;
  grid-template-columns: 28px 1fr 72px 40px;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(230, 247, 255, 0.88);
}

.screen-city-rank__rank {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 80, 140, 0.35);
  color: rgba(186, 231, 255, 0.85);
  font-weight: 600;
}

.screen-city-rank__rank.top3 {
  background: linear-gradient(135deg, rgba(255, 214, 102, 0.85), rgba(255, 152, 0, 0.75));
  color: #1a1200;
}

.screen-city-rank__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.screen-city-rank__bar-wrap {
  height: 6px;
  background: rgba(0, 80, 140, 0.25);
  border-radius: 999px;
  overflow: hidden;
}

.screen-city-rank__bar {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #146ba8, #40e0ff);
  border-radius: 999px;
}

.screen-city-rank__count {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #40e0ff;
}

.screen-city-rank__empty {
  padding: 24px 0;
  text-align: center;
  color: rgba(186, 231, 255, 0.45);
  font-size: 13px;
}
</style>
