<template>
  <div ref="mapRoot" class="checkin-map-root" />
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
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
}>();

const emit = defineEmits<{
  select: [id: number];
}>();

const mapRoot = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let markerLayer: L.LayerGroup | null = null;
let polyline: L.Polyline | null = null;

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
    { color: '#1677ff', weight: 4, opacity: 0.65 },
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

async function refreshMapSize() {
  await nextTick();
  map?.invalidateSize(true);
}

watch(
  () => props.items,
  () => {
    renderLayers();
    refreshMapSize();
  },
  { deep: true },
);

watch(
  () => props.selectedId,
  (id) => {
    renderMarkers();
    if (id == null) {
      applyChinaView(true);
      return;
    }
    focusSelected();
  },
);

onMounted(async () => {
  await nextTick();
  initMap();
  await refreshMapSize();
  window.setTimeout(() => map?.invalidateSize(true), 200);
});

onUnmounted(() => {
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
  height: calc(100vh - 240px);
  min-height: 640px;
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
