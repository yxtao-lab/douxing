<template>
  <div ref="chartRoot" class="resource-donut-chart" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EChartsOption } from 'echarts';
import { useECharts } from '@/composables/useECharts';

/** 饼图单项数据 */
export interface DonutChartDataItem {
  name: string;
  value: number;
}

const props = defineProps<{
  /** 饼图数据 */
  data: DonutChartDataItem[];
  /** 中央标题（可选） */
  centerTitle?: string;
  /** 中央副标题（可选，常用于合计数值） */
  centerSub?: string;
  /** 高度，默认 320px */
  height?: string;
}>();

const option = computed<EChartsOption>(() => ({
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {c} ({d}%)',
  },
  legend: {
    orient: 'vertical',
    right: 8,
    top: 'center',
    itemWidth: 12,
    itemHeight: 8,
    textStyle: { color: '#6b7280', fontSize: 12 },
  },
  series: [
    {
      name: props.centerTitle ?? '',
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['38%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 6,
        borderColor: '#fff',
        borderWidth: 2,
      },
      label: {
        show: true,
        formatter: '{b}\n{d}%',
        color: '#374151',
        fontSize: 12,
      },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold' },
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' },
      },
      data: props.data,
    },
  ],
  graphic: props.centerTitle
    ? [
        {
          type: 'text',
          left: '38%',
          top: '42%',
          style: {
            text: props.centerTitle,
            textAlign: 'center',
            fill: '#6b7280',
            fontSize: 13,
          },
        },
        {
          type: 'text',
          left: '38%',
          top: '52%',
          style: {
            text: props.centerSub ?? '',
            textAlign: 'center',
            fill: '#111827',
            fontSize: 18,
            fontWeight: 'bold',
          },
        },
      ]
    : [],
}));

const { chartRoot } = useECharts(option);
</script>

<style scoped>
.resource-donut-chart {
  width: 100%;
  height: v-bind('height ?? "320px"');
  min-width: 0;
}
</style>
