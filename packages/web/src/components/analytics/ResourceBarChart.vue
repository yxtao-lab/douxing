<template>
  <div ref="chartRoot" class="resource-bar-chart" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EChartsOption } from 'echarts';
import { useECharts } from '@/composables/useECharts';

/** 柱状图单项数据 */
export interface BarChartDataItem {
  name: string;
  value: number;
}

const props = defineProps<{
  /** 柱状图数据 */
  data: BarChartDataItem[];
  /** 数值轴名称（i18n 后传入） */
  valueAxisName?: string;
  /** 高度，默认 320px */
  height?: string;
  /** 是否横向柱状图，默认 false（纵向） */
  horizontal?: boolean;
  /** 是否显示数值标签，默认 true */
  showLabel?: boolean;
}>();

const PALETTE = [
  '#1677ff',
  '#008cba',
  '#fa8c16',
  '#52c41a',
  '#722ed1',
  '#13c2c2',
  '#eb2f96',
  '#faad14',
  '#a0d911',
  '#2f54eb',
];

const option = computed<EChartsOption>(() => {
  const horizontal = props.horizontal ?? false;
  const names = props.data.map((d) => d.name);
  const values = props.data.map((d) => d.value);
  const showLabel = props.showLabel ?? true;

  const categoryAxis = {
    type: 'category' as const,
    data: names,
    axisLabel: { color: '#6b7280', fontSize: 11 },
    axisLine: { lineStyle: { color: '#e5e7eb' } },
    axisTick: { show: false },
  };
  const valueAxis = {
    type: 'value' as const,
    name: props.valueAxisName,
    minInterval: 1,
    axisLabel: { color: '#6b7280', fontSize: 11 },
    splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' as const } },
  };

  return {
    color: PALETTE,
    grid: {
      left: 8,
      right: 16,
      top: 32,
      bottom: 8,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series: [
      {
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            color: PALETTE[i % PALETTE.length],
            borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
          },
        })),
        barMaxWidth: 36,
        label: {
          show: showLabel,
          position: horizontal ? 'right' : 'top',
          color: '#374151',
          fontSize: 11,
        },
      },
    ],
  };
});

const { chartRoot } = useECharts(option);
</script>

<style scoped>
.resource-bar-chart {
  width: 100%;
  height: v-bind('height ?? "320px"');
  min-width: 0;
}
</style>
