<template>
  <div ref="chartRoot" class="resource-line-chart" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EChartsOption } from 'echarts';
import { useECharts } from '@/composables/useECharts';

/** 折线图分类轴单项 */
export interface LineChartCategoryItem {
  name: string;
  /** 主系列数值（如新增行 / 文件数） */
  primary: number;
  /** 次系列数值（如删除行 / 行数） */
  secondary: number;
  /**
   * 可选第三系列（如代码总量）。
   * 存在时：primary + secondary 共用左轴，tertiary 独占右轴。
   */
  tertiary?: number;
}

const props = defineProps<{
  /** 折线数据 */
  data: LineChartCategoryItem[];
  /** 主系列名称 */
  primaryName: string;
  /** 次系列名称 */
  secondaryName: string;
  /** 可选第三系列名称；传入即绘制 */
  tertiaryName?: string;
  /** 高度，默认 320px */
  height?: string;
}>();

/**
 * 构建面积渐变配置。
 *
 * @param rgbaTop - 顶部颜色（含透明度）
 * @param rgbaBottom - 底部颜色（含透明度）
 * @returns ECharts areaStyle.color 线性渐变
 */
function buildAreaGradient(rgbaTop: string, rgbaBottom: string) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: rgbaTop },
      { offset: 1, color: rgbaBottom },
    ],
  };
}

const option = computed<EChartsOption>(() => {
  const names = props.data.map((d) => d.name);
  const primary = props.data.map((d) => d.primary);
  const secondary = props.data.map((d) => d.secondary);
  const hasTertiary = Boolean(props.tertiaryName);
  const tertiary = hasTertiary ? props.data.map((d) => d.tertiary ?? 0) : [];

  // 有总量线：左轴=新增/删除，右轴=总量；否则沿用双轴主/次拆分
  const leftAxisName = hasTertiary
    ? `${props.primaryName} / ${props.secondaryName}`
    : props.primaryName;
  const rightAxisName = hasTertiary ? (props.tertiaryName ?? '') : props.secondaryName;
  const secondaryAxisIndex = hasTertiary ? 0 : 1;

  const series: EChartsOption['series'] = [
    {
      name: props.primaryName,
      type: 'line',
      yAxisIndex: 0,
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      areaStyle: {
        color: buildAreaGradient('rgba(22, 119, 255, 0.22)', 'rgba(22, 119, 255, 0.02)'),
      },
      data: primary,
    },
    {
      name: props.secondaryName,
      type: 'line',
      yAxisIndex: secondaryAxisIndex,
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      areaStyle: {
        color: buildAreaGradient('rgba(19, 194, 194, 0.18)', 'rgba(19, 194, 194, 0.02)'),
      },
      data: secondary,
    },
  ];

  if (hasTertiary && props.tertiaryName) {
    series.push({
      name: props.tertiaryName,
      type: 'line',
      yAxisIndex: 1,
      smooth: true,
      connectNulls: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { width: 2.5 },
      itemStyle: { color: '#fa8c16' },
      data: tertiary,
    });
  }

  return {
    color: ['#1677ff', '#13c2c2', '#fa8c16'],
    grid: {
      left: 8,
      right: 24,
      top: 48,
      bottom: 8,
      containLabel: true,
    },
    legend: {
      top: 4,
      textStyle: { color: '#6b7280', fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      type: 'category',
      data: names,
      boundaryGap: false,
      axisLabel: { color: '#6b7280', fontSize: 11 },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: leftAxisName,
        minInterval: 1,
        axisLabel: { color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
      },
      {
        type: 'value',
        name: rightAxisName,
        minInterval: 1,
        axisLabel: { color: hasTertiary ? '#fa8c16' : '#6b7280', fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series,
  };
});

const { chartRoot } = useECharts(option);
</script>

<style scoped>
.resource-line-chart {
  width: 100%;
  height: v-bind('height ?? "320px"');
  min-width: 0;
}
</style>
