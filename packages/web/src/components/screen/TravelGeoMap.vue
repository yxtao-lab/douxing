<template>
  <div ref="chartRoot" class="travel-geo-map">
    <p v-if="loadError" class="travel-geo-map__error">{{ loadError }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { AnalyticsCityGeoStat, AnalyticsGeoFlow, AnalyticsProvinceGeoStat } from '@douxing/shared';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts/core';
import { MapChart, LinesChart, EffectScatterChart } from 'echarts/charts';
import {
  GeoComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  MapChart,
  LinesChart,
  EffectScatterChart,
  GeoComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

const CHINA_MAP_SOURCES = [
  '/geo/china.json',
  'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json',
];

const props = defineProps<{
  provinces: AnalyticsProvinceGeoStat[];
  cities: AnalyticsCityGeoStat[];
  flows: AnalyticsGeoFlow[];
  emptyLabel: string;
}>();

const chartRoot = ref<HTMLElement | null>(null);
const loadError = ref('');
let chart: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;
let mapRegistered = false;

async function ensureChinaMap() {
  if (mapRegistered) return;
  let lastError: unknown;
  for (const url of CHINA_MAP_SOURCES) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const geoJson = await response.json();
      echarts.registerMap('china', geoJson);
      mapRegistered = true;
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('china map load failed');
}

function buildOption(): EChartsOption {
  const hasProvinceData = props.provinces.length > 0;
  const maxProvince = Math.max(1, ...props.provinces.map((item) => item.checkinCount));
  const mapData = props.provinces.map((item) => ({
    name: item.geoName,
    value: item.checkinCount,
  }));

  const scatterData = props.cities
    .filter((city) => Number.isFinite(city.latitude) && Number.isFinite(city.longitude) && city.latitude !== 0)
    .slice(0, 12)
    .map((city) => ({
      name: city.cityName,
      value: [city.longitude, city.latitude, city.checkinCount],
    }));

  const lineData = props.flows.slice(0, 15).map((flow) => ({
    coords: [
      [flow.fromLongitude, flow.fromLatitude],
      [flow.toLongitude, flow.toLatitude],
    ],
    value: flow.count,
  }));

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(4, 16, 32, 0.92)',
      borderColor: 'rgba(0, 196, 255, 0.45)',
      textStyle: { color: '#e6f7ff' },
    },
    graphic: hasProvinceData
      ? undefined
      : [
          {
            type: 'text',
            left: 'center',
            top: 'middle',
            style: {
              text: props.emptyLabel,
              fill: 'rgba(186, 231, 255, 0.55)',
              fontSize: 14,
            },
          },
        ],
    visualMap: {
      min: 0,
      max: maxProvince,
      left: 16,
      bottom: 16,
      calculable: false,
      show: hasProvinceData,
      text: ['', ''],
      inRange: {
        color: ['#0a2a45', '#146ba8', '#29b6f6', '#7ae582'],
      },
      textStyle: { color: 'rgba(186, 231, 255, 0.7)' },
    },
    geo: {
      map: 'china',
      roam: false,
      zoom: 1.12,
      center: [104, 36],
      itemStyle: {
        areaColor: '#0a1f35',
        borderColor: 'rgba(0, 196, 255, 0.35)',
        borderWidth: 0.8,
      },
      emphasis: {
        itemStyle: {
          areaColor: '#145a8a',
        },
        label: { show: false },
      },
      label: { show: false },
    },
    series: [
      {
        name: 'province',
        type: 'map',
        map: 'china',
        geoIndex: 0,
        data: mapData,
      },
      {
        name: 'flow',
        type: 'lines',
        coordinateSystem: 'geo',
        zlevel: 2,
        effect: {
          show: lineData.length > 0,
          period: 4,
          trailLength: 0.35,
          symbol: 'arrow',
          symbolSize: 6,
          color: '#ffd666',
        },
        lineStyle: {
          color: '#ffd666',
          width: 1,
          opacity: 0.55,
          curveness: 0.25,
        },
        data: lineData,
      },
      {
        name: 'city',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        zlevel: 3,
        rippleEffect: {
          brushType: 'stroke',
          scale: 3,
        },
        symbolSize(value: number[]) {
          const count = value[2] ?? 1;
          return Math.min(18, 6 + Math.sqrt(count));
        },
        itemStyle: {
          color: '#40e0ff',
          shadowBlur: 12,
          shadowColor: 'rgba(64, 224, 255, 0.65)',
        },
        data: scatterData,
      },
    ],
  };
}

function renderChart() {
  if (!chart) return;
  chart.setOption(buildOption(), { notMerge: true });
}

async function initChart() {
  if (!chartRoot.value) return;
  try {
    await ensureChinaMap();
    loadError.value = '';
    chart = echarts.init(chartRoot.value);
    renderChart();
  } catch (err) {
    console.error('[TravelGeoMap]', err);
    loadError.value = props.emptyLabel;
  }
}

onMounted(async () => {
  await initChart();
  if (!chartRoot.value || typeof ResizeObserver === 'undefined') return;
  resizeObserver = new ResizeObserver(() => chart?.resize());
  resizeObserver.observe(chartRoot.value);
});

watch(
  () => [props.provinces, props.cities, props.flows, props.emptyLabel] as const,
  () => {
    renderChart();
  },
  { deep: true },
);

onUnmounted(() => {
  resizeObserver?.disconnect();
  chart?.dispose();
  chart = null;
});
</script>

<style scoped>
.travel-geo-map {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
}

.travel-geo-map__error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  color: rgba(186, 231, 255, 0.55);
  font-size: 14px;
}
</style>
