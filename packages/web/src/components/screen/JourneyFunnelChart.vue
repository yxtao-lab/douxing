<template>
  <div ref="chartRoot" class="journey-funnel-chart" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { AnalyticsFunnelStep } from '@douxing/shared';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts/core';
import { FunnelChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([FunnelChart, TooltipComponent, LegendComponent, CanvasRenderer]);

const props = defineProps<{
  steps: AnalyticsFunnelStep[];
  labels: Record<string, string>;
  emptyLabel: string;
}>();

const chartRoot = ref<HTMLElement | null>(null);
let chart: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

function buildOption(): EChartsOption {
  const data = props.steps.map((step) => ({
    name: props.labels[step.stepKey] ?? step.stepKey,
    value: step.count,
  }));

  return {
    backgroundColor: 'transparent',
    color: ['#40e0ff', '#29b6f6', '#1e88e5', '#7c4dff', '#ffd666', '#7ae582'],
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}',
      backgroundColor: 'rgba(4, 16, 32, 0.92)',
      borderColor: 'rgba(0, 196, 255, 0.45)',
      textStyle: { color: '#e6f7ff' },
    },
    series: [
      {
        type: 'funnel',
        left: '8%',
        top: 12,
        bottom: 12,
        width: '84%',
        min: 0,
        max: Math.max(1, ...props.steps.map((step) => step.count)),
        minSize: '18%',
        maxSize: '100%',
        sort: 'descending',
        gap: 4,
        label: {
          show: true,
          position: 'inside',
          color: '#fff',
          fontSize: 11,
        },
        itemStyle: {
          borderColor: 'rgba(0, 196, 255, 0.25)',
          borderWidth: 1,
        },
        data,
      },
    ],
  };
}

function renderChart() {
  if (!chart) return;
  if (props.steps.length === 0) {
    chart.clear();
    chart.setOption({
      title: {
        text: props.emptyLabel,
        left: 'center',
        top: 'middle',
        textStyle: { color: 'rgba(186, 231, 255, 0.55)', fontSize: 14 },
      },
    });
    return;
  }
  chart.setOption(buildOption(), { notMerge: true });
}

onMounted(() => {
  if (!chartRoot.value) return;
  chart = echarts.init(chartRoot.value);
  renderChart();
  if (typeof ResizeObserver === 'undefined') return;
  resizeObserver = new ResizeObserver(() => chart?.resize());
  resizeObserver.observe(chartRoot.value);
});

watch(
  () => [props.steps, props.labels, props.emptyLabel] as const,
  () => renderChart(),
  { deep: true },
);

onUnmounted(() => {
  resizeObserver?.disconnect();
  chart?.dispose();
});
</script>

<style scoped>
.journey-funnel-chart {
  width: 100%;
  height: 100%;
  min-height: 280px;
}
</style>
