<template>
  <div ref="chartRoot" class="analytics-trend-chart" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { AnalyticsDailyPoint } from '@douxing/shared';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export interface TrendSeriesLabels {
  users: string;
  routes: string;
  orders: string;
  checkins: string;
  planSessions: string;
}

const props = defineProps<{
  data: AnalyticsDailyPoint[];
  labels: TrendSeriesLabels;
}>();

const chartRoot = ref<HTMLElement | null>(null);
let chart: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

const SERIES_COLORS = {
  users: '#1677ff',
  routes: '#008cba',
  orders: '#fa8c16',
  checkins: '#52c41a',
  planSessions: '#722ed1',
} as const;

function formatAxisDate(date: string) {
  return date.slice(5);
}

function buildOption(data: AnalyticsDailyPoint[]): EChartsOption {
  const dates = data.map((point) => formatAxisDate(point.date));

  const buildSeries = (
    key: keyof Omit<AnalyticsDailyPoint, 'date'>,
    label: string,
  ) => ({
    name: label,
    type: 'line' as const,
    smooth: true,
    showSymbol: data.length <= 31,
    symbolSize: 6,
    lineStyle: { width: 2 },
    itemStyle: { color: SERIES_COLORS[key] },
    data: data.map((point) => point[key]),
  });

  return {
    color: Object.values(SERIES_COLORS),
    grid: {
      left: 8,
      right: 16,
      top: 40,
      bottom: 8,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    legend: {
      top: 0,
      left: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: '#6b7280', fontSize: 12 },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLabel: { color: '#6b7280', fontSize: 11 },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
    },
    series: [
      buildSeries('users', props.labels.users),
      buildSeries('routes', props.labels.routes),
      buildSeries('orders', props.labels.orders),
      buildSeries('checkins', props.labels.checkins),
      buildSeries('planSessions', props.labels.planSessions),
    ],
  };
}

function renderChart() {
  if (!chart) return;
  chart.setOption(buildOption(props.data), { notMerge: true });
}

function initChart() {
  if (!chartRoot.value) return;
  chart = echarts.init(chartRoot.value);
  renderChart();
}

onMounted(async () => {
  initChart();
  if (!chartRoot.value || typeof ResizeObserver === 'undefined') return;
  resizeObserver = new ResizeObserver(() => {
    chart?.resize();
  });
  resizeObserver.observe(chartRoot.value);
});

watch(
  () => [props.data, props.labels] as const,
  () => {
    renderChart();
  },
  { deep: true },
);

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  chart?.dispose();
  chart = null;
});
</script>

<style scoped>
.analytics-trend-chart {
  width: 100%;
  height: 320px;
  min-width: 0;
}
</style>
