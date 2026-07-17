<template>
  <div ref="chartRoot" class="resource-radar-chart" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EChartsOption } from 'echarts';
import { useECharts } from '@/composables/useECharts';

/** 雷达图单个维度 */
export interface RadarIndicatorItem {
  name: string;
  max: number;
}

/** 雷达图单条系列 */
export interface RadarSeriesItem {
  name: string;
  values: number[];
}

const props = defineProps<{
  /** 维度定义（含 max） */
  indicators: RadarIndicatorItem[];
  /** 系列数据 */
  series: RadarSeriesItem[];
  /** 高度，默认 320px */
  height?: string;
}>();

const PALETTE = ['#1677ff', '#13c2c2', '#fa8c16', '#722ed1'];

const option = computed<EChartsOption>(() => ({
  color: PALETTE,
  legend: {
    bottom: 0,
    textStyle: { color: '#6b7280', fontSize: 12 },
  },
  tooltip: { trigger: 'item' },
  radar: {
    indicator: props.indicators.map((i) => ({ name: i.name, max: Math.max(i.max, 1) })),
    center: ['50%', '48%'],
    radius: '58%',
    splitNumber: 4,
    axisName: { color: '#6b7280', fontSize: 11 },
    splitArea: {
      areaStyle: {
        color: ['rgba(22, 119, 255, 0.04)', 'rgba(22, 119, 255, 0.08)'],
      },
    },
    splitLine: { lineStyle: { color: '#e5e7eb' } },
    axisLine: { lineStyle: { color: '#e5e7eb' } },
  },
  series: [
    {
      type: 'radar',
      data: props.series.map((s) => ({
        name: s.name,
        value: s.values,
        areaStyle: { opacity: 0.18 },
      })),
    },
  ],
}));

const { chartRoot } = useECharts(option);
</script>

<style scoped>
.resource-radar-chart {
  width: 100%;
  height: v-bind('height ?? "320px"');
  min-width: 0;
}
</style>
