<template>
  <div ref="mapRoot" class="route-solver-map" :style="{ height: `${height}px` }" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import { mountCheckInTileLayer } from '@/utils/checkin-map-tiles';
import 'leaflet/dist/leaflet.css';

export interface RouteSolverMapPoint {
  name: string;
  lat: number;
  lng: number;
  seq?: number;
}

const props = withDefaults(
  defineProps<{
    points: RouteSolverMapPoint[];
    orderIndexes?: number[];
    height?: number;
  }>(),
  { height: 360, orderIndexes: () => [] },
);

const mapRoot = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let layer: L.LayerGroup | null = null;

/**
 * 初始化 Leaflet 地图。
 *
 * @returns void
 */
function initMap(): void {
  if (!mapRoot.value || map) return;
  map = L.map(mapRoot.value, {
    center: [30.25, 120.15],
    zoom: 12,
    zoomControl: true,
  });
  mountCheckInTileLayer(map);
  layer = L.layerGroup().addTo(map);
  render();
}

/**
 * 根据点位与访问顺序重绘标记与折线。
 *
 * @returns void
 */
function render(): void {
  if (!map || !layer) return;
  layer.clearLayers();
  const pts = props.points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  );
  if (pts.length === 0) return;

  const ordered =
    props.orderIndexes && props.orderIndexes.length > 0
      ? props.orderIndexes
          .map((i) => pts[i])
          .filter((p): p is RouteSolverMapPoint => Boolean(p))
      : pts;

  const latLngs: L.LatLngExpression[] = [];
  ordered.forEach((p, idx) => {
    const ll: L.LatLngExpression = [p.lat, p.lng];
    latLngs.push(ll);
    const marker = L.circleMarker(ll, {
      radius: 8,
      color: '#1677ff',
      fillColor: '#1677ff',
      fillOpacity: 0.85,
      weight: 2,
    });
    marker.bindPopup(`${idx + 1}. ${p.name}`);
    layer!.addLayer(marker);
  });

  if (latLngs.length >= 2) {
    layer.addLayer(
      L.polyline(latLngs, {
        color: '#1677ff',
        weight: 3,
        opacity: 0.8,
      }),
    );
  }

  const bounds = L.latLngBounds(latLngs);
  map.fitBounds(bounds.pad(0.2));
}

onMounted(() => {
  initMap();
});

onUnmounted(() => {
  map?.remove();
  map = null;
  layer = null;
});

watch(
  () => [props.points, props.orderIndexes] as const,
  () => render(),
  { deep: true },
);
</script>

<style scoped>
.route-solver-map {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--dx-border, #f0f0f0);
}
</style>
