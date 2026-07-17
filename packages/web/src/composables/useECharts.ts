import { onMounted, onUnmounted, ref, watch, toValue, type MaybeRefOrGetter } from 'vue';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, RadarChart } from 'echarts/charts';
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
]);

/**
 * 通用 ECharts 初始化 / 自适应 / 销毁 composable。
 *
 * @param option - 响应式 ECharts option（支持 ref / computed / getter，变化后自动 setOption）
 * @returns `chartRoot` 绑定到模板容器 ref；`chart` 实例 ref
 */
export function useECharts(option: MaybeRefOrGetter<EChartsOption>) {
  const chartRoot = ref<HTMLElement | null>(null);
  const chart = ref<echarts.ECharts | null>(null);
  let resizeObserver: ResizeObserver | null = null;

  function renderChart() {
    if (!chart.value) return;
    chart.value.setOption(toValue(option), { notMerge: true });
  }

  function initChart() {
    if (!chartRoot.value) return;
    chart.value = echarts.init(chartRoot.value);
    renderChart();
  }

  onMounted(() => {
    initChart();
    if (!chartRoot.value || typeof ResizeObserver === 'undefined') return;
    resizeObserver = new ResizeObserver(() => {
      chart.value?.resize();
    });
    resizeObserver.observe(chartRoot.value);
  });

  watch(option, renderChart, { deep: true });

  onUnmounted(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    chart.value?.dispose();
    chart.value = null;
  });

  return { chartRoot, chart };
}
