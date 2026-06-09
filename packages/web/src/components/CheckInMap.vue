<template>
  <div ref="mapRoot" class="checkin-map-root" :style="rootStyle" />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import type { CheckInInfo } from '@douxing/shared';
import {
  buildCheckInPolylinePoints,
  getCheckInsWithCoords,
  getDefaultChinaMapView,
} from '@douxing/shared';
import {
  buildCheckInMarkerHtml,
  buildCheckInPopupHtml,
  getMarkerIconSize,
} from '@/utils/checkin-map-marker';
import { mountCheckInTileLayer } from '@/utils/checkin-map-tiles';
import '@/styles/checkin-map-marker.css';
import 'leaflet/dist/leaflet.css';

const props = defineProps<{
  items: CheckInInfo[];
  selectedId: number | null;
  height?: number;
}>();

const emit = defineEmits<{
  select: [id: number];
}>();

const mapRoot = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let markerLayer: L.LayerGroup | null = null;
let polyline: L.Polyline | null = null;
let resizeObserver: ResizeObserver | null = null;

const rootStyle = computed(() => {
  if (props.height && props.height > 0) {
    return { height: `${props.height}px` };
  }
  return undefined;
});

function applyChinaView(animate = false) {
  if (!map) return;
  const view = getDefaultChinaMapView();
  map.setView([view.lat, view.lng], view.zoom, { animate });
}

function initMap() {
  if (!mapRoot.value || map) return;

  const view = getDefaultChinaMapView();
  map = L.map(mapRoot.value, {
    center: [view.lat, view.lng],
    zoom: view.zoom,
    zoomControl: true,
    minZoom: 3,
    maxZoom: 18,
  });

  mountCheckInTileLayer(map);
  markerLayer = L.layerGroup().addTo(map);
  renderLayers();
}

function renderMarkers() {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers();

  for (const item of getCheckInsWithCoords(props.items)) {
    const lat = item.location.latitude!;
    const lng = item.location.longitude!;
    const active = item.id === props.selectedId;
    const { width, height } = getMarkerIconSize(item);

    const icon = L.divIcon({
      className: 'checkin-leaflet-icon',
      html: buildCheckInMarkerHtml(item, active),
      iconSize: [width, height],
      iconAnchor: [width / 2, height],
    });

    const marker = L.marker([lat, lng], { icon });
    marker.bindPopup(buildCheckInPopupHtml(item), { maxWidth: 240 });
    marker.on('click', () => emit('select', item.id));
    markerLayer.addLayer(marker);
  }
}

function renderPolyline() {
  if (!map) return;
  if (polyline) {
    polyline.remove();
    polyline = null;
  }

  const points = buildCheckInPolylinePoints(props.items);
  if (points.length < 2) return;

  polyline = L.polyline(
    points.map((point) => [point.lat, point.lng] as L.LatLngExpression),
    { color: '#008cba', weight: 4, opacity: 0.65 },
  ).addTo(map);
}

function renderLayers() {
  renderMarkers();
  renderPolyline();

  if (!map) return;
  if (props.selectedId == null) {
    applyChinaView();
  }
}

function focusSelected() {
  if (!map || props.selectedId == null) return;
  const item = props.items.find((row) => row.id === props.selectedId);
  if (!item?.location.latitude || item.location.longitude == null) return;
  map.setView([item.location.latitude, item.location.longitude], Math.max(map.getZoom(), 14), {
    animate: true,
  });
}

async function syncMapSize() {
  await nextTick();
  const el = mapRoot.value;
  if (!el || el.clientWidth < 1 || el.clientHeight < 1) return;

  if (!map) {
    initMap();
  }
  map?.invalidateSize(true);
}

watch(
  () => props.items,
  () => {
    if (!map) {
      void syncMapSize();
      return;
    }
    renderLayers();
    void syncMapSize();
  },
  { deep: true },
);

watch(
  () => props.selectedId,
  (id) => {
    if (!map) return;
    renderMarkers();
    if (id == null) {
      applyChinaView(true);
      return;
    }
    focusSelected();
  },
);

watch(
  () => props.height,
  () => {
    void syncMapSize();
  },
);

onMounted(async () => {
  await nextTick();
  if (!mapRoot.value) return;

  resizeObserver = new ResizeObserver(() => {
    void syncMapSize();
  });
  resizeObserver.observe(mapRoot.value);
  await syncMapSize();
  window.setTimeout(() => void syncMapSize(), 200);
  window.setTimeout(() => void syncMapSize(), 600);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  polyline?.remove();
  map?.remove();
  map = null;
  markerLayer = null;
  polyline = null;
});
</script>

<style scoped>
.checkin-map-root {
  width: 100%;
  min-height: 320px;
  border-radius: 8px;
  overflow: hidden;
  background: #e5e7eb;
}

.checkin-map-root :deep(.leaflet-container) {
  width: 100%;
  height: 100%;
  z-index: 0;
}
</style>
