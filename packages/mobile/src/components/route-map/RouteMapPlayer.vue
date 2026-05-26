<template>
  <view class="route-map-player">
    <view class="map-header">
      <text class="map-title">{{ t('routeMap.title') }}</text>
      <text v-if="hiddenHint" class="map-hint">{{ hiddenHint }}</text>
    </view>

    <view class="map-wrap">
      <map
        id="routeMapPlayer"
        class="map"
        :latitude="mapCenter.latitude"
        :longitude="mapCenter.longitude"
        :scale="mapScale"
        :markers="displayMarkers"
        :polyline="displayPolylines"
        :include-points="includePoints"
        enable-zoom
        enable-scroll
      />
    </view>

    <view class="controls">
      <button class="btn-control" size="mini" @click="handleTogglePlay">
        {{ playing ? t('routeMap.pause') : t('routeMap.play') }}
      </button>
      <button class="btn-control" size="mini" @click="handleReplay">
        {{ t('routeMap.replay') }}
      </button>
      <text v-if="playing" class="status-text">{{ t('routeMap.animating') }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import type { LatLng, RoutePath } from '@douxing/shared';
import { createRoutePathAnimation } from '@/utils/route-path-animation';
import {
  buildRouteIncludePoints,
  buildRoutePolyline,
  buildRoutePoiMarkers,
  buildTravelerMarker,
  getRoutePathAnchorPoints,
  resolveRouteMapCenter,
} from '@/utils/route-map';
import { useTf } from '@/i18n/useTf';

const props = withDefaults(
  defineProps<{
    routePath: RoutePath | null;
    autoPlay?: boolean;
    durationMs?: number;
  }>(),
  {
    autoPlay: true,
    durationMs: 8000,
  },
);

const { t, tf } = useTf();

const playing = ref(false);
const animatedPolylinePoints = ref<LatLng[]>([]);
const travelerPoint = ref<LatLng | null>(null);
const mapScale = ref(12);

let animationController: ReturnType<typeof createRoutePathAnimation> | null = null;

const anchorPoints = computed(() =>
  props.routePath ? getRoutePathAnchorPoints(props.routePath) : [],
);

const mapCenter = computed(() => resolveRouteMapCenter(anchorPoints.value));

const includePoints = computed(() => buildRouteIncludePoints(anchorPoints.value));

const poiMarkers = computed(() =>
  props.routePath ? buildRoutePoiMarkers(props.routePath.pois) : [],
);

const displayMarkers = computed(() => {
  const markers = [...poiMarkers.value];
  if (travelerPoint.value) {
    markers.push(buildTravelerMarker(travelerPoint.value));
  }
  return markers;
});

const displayPolylines = computed(() => buildRoutePolyline(animatedPolylinePoints.value));

const hiddenHint = computed(() => {
  if (!props.routePath || props.routePath.hiddenSpotCount <= 0) return '';
  return tf('routeMap.hiddenSpots', { count: props.routePath.hiddenSpotCount });
});

function destroyAnimation() {
  animationController?.destroy();
  animationController = null;
  playing.value = false;
}

function setupAnimation() {
  destroyAnimation();
  if (!props.routePath || props.routePath.fullPoints.length < 2) {
    animatedPolylinePoints.value = [];
    travelerPoint.value = null;
    return;
  }

  const fullPoints = props.routePath.fullPoints;
  animatedPolylinePoints.value = [fullPoints[0]!];
  travelerPoint.value = fullPoints[0]!;
  mapScale.value = mapCenter.value.scale;

  animationController = createRoutePathAnimation({
    fullPoints,
    durationMs: props.durationMs,
    onPolylineUpdate(points) {
      animatedPolylinePoints.value = points;
    },
    onMarkerUpdate(point) {
      travelerPoint.value = point;
    },
    onComplete() {
      playing.value = false;
    },
  });

  if (props.autoPlay) {
    playing.value = true;
    animationController.play();
  }
}

function handleTogglePlay() {
  if (!animationController) return;
  if (playing.value) {
    animationController.pause();
    playing.value = false;
    return;
  }
  animationController.play();
  playing.value = true;
}

function handleReplay() {
  if (!animationController) return;
  animationController.restart();
  animationController.play();
  playing.value = true;
}

watch(
  () => props.routePath,
  () => {
    setupAnimation();
  },
  { immediate: true },
);

onUnmounted(() => {
  destroyAnimation();
});
</script>

<style scoped>
.route-map-player {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.map-header {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.map-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
}

.map-hint {
  font-size: 22rpx;
  color: #9ca3af;
}

.map-wrap {
  position: relative;
  height: 420rpx;
  border-radius: 12rpx;
  overflow: hidden;
}

.map {
  width: 100%;
  height: 100%;
}

.controls {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.btn-control {
  margin: 0;
  background: #f3f4f6;
  color: #374151;
  font-size: 24rpx;
  border: none;
  border-radius: 999rpx;
}

.status-text {
  font-size: 22rpx;
  color: #1677ff;
}
</style>
