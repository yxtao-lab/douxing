<template>
  <view class="route-map-player">
    <view v-if="!isFullscreen" class="map-header">
      <view class="map-title-row">
        <text class="map-title">{{ t('routeMap.title') }}</text>
        <text v-if="routePath?.date" class="map-date">{{ routePath.date }}</text>
      </view>
      <text v-if="hiddenHint" class="map-hint">{{ hiddenHint }}</text>
    </view>

    <view v-if="!isFullscreen" class="map-wrap">
      <map
        v-if="mapReady"
        id="routeMapPlayer"
        class="map"
        :latitude="mapCenter.latitude"
        :longitude="mapCenter.longitude"
        :scale="mapScale"
        :markers="displayMarkers"
        :polyline="displayPolylines"
        :include-points="mapIncludePoints"
        enable-zoom
        enable-scroll
      >
        <!-- #ifdef MP-WEIXIN -->
        <cover-view class="map-overlay-tools">
          <cover-view class="map-tool-btn" @tap="openFullscreen">
            <cover-view class="map-tool-btn-text">{{ t('routeMap.fullscreen') }}</cover-view>
          </cover-view>
        </cover-view>
        <!-- #endif -->
      </map>

      <!-- #ifndef MP-WEIXIN -->
      <view
        v-if="mapReady"
        class="map-tool-btn map-tool-btn--overlay"
        role="button"
        @click="openFullscreen"
      >
        <text class="map-tool-btn-text">{{ t('routeMap.fullscreen') }}</text>
      </view>
      <!-- #endif -->
    </view>

    <view v-if="!isFullscreen" class="controls">
      <button class="btn-control" size="mini" @click="handleTogglePlay">
        {{ playing ? t('routeMap.pause') : t('routeMap.play') }}
      </button>
      <button class="btn-control" size="mini" @click="handleReplay">
        {{ t('routeMap.replay') }}
      </button>
      <text v-if="playing" class="status-text">{{ t('routeMap.animating') }}</text>
    </view>

    <view
      v-if="isFullscreen"
      class="map-fullscreen-root"
      @touchmove.stop.prevent
    >
      <view class="map-fullscreen-header">
        <text class="map-fullscreen-title">{{ fullscreenTitle }}</text>
        <!-- #ifndef MP-WEIXIN -->
        <view class="map-tool-btn map-tool-btn--header" role="button" @click="closeFullscreen">
          <text class="map-tool-btn-text">{{ t('routeMap.exitFullscreen') }}</text>
        </view>
        <!-- #endif -->
      </view>

      <view class="map-wrap map-wrap--fullscreen">
        <map
          v-if="mapReady"
          id="routeMapPlayerFullscreen"
          class="map"
          :latitude="mapCenter.latitude"
          :longitude="mapCenter.longitude"
          :scale="mapScale"
          :markers="displayMarkers"
          :polyline="displayPolylines"
          :include-points="mapIncludePoints"
          enable-zoom
          enable-scroll
        >
          <!-- #ifdef MP-WEIXIN -->
          <cover-view class="map-overlay-tools map-overlay-tools--fullscreen">
            <cover-view class="map-tool-btn map-tool-btn--exit" @tap="closeFullscreen">
              <cover-view class="map-tool-btn-text">{{ t('routeMap.exitFullscreen') }}</cover-view>
            </cover-view>
          </cover-view>
          <!-- #endif -->
        </map>
      </view>

      <view class="map-fullscreen-controls">
        <button class="btn-control" size="mini" @click="handleTogglePlay">
          {{ playing ? t('routeMap.pause') : t('routeMap.play') }}
        </button>
        <button class="btn-control" size="mini" @click="handleReplay">
          {{ t('routeMap.replay') }}
        </button>
        <text v-if="playing" class="status-text">{{ t('routeMap.animating') }}</text>
      </view>
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
  clampMapScale,
  getRoutePathAnchorPoints,
  isMpWeixinMapPlatform,
  resolveRouteMapCenter,
  simplifyMapPolylinePoints,
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

const mpWeixinMap = isMpWeixinMapPlatform();
const playing = ref(false);
const animatedPolylinePoints = ref<LatLng[]>([]);
const travelerPoint = ref<LatLng | null>(null);
const mapScale = ref(12);
const mapReady = ref(false);
const isFullscreen = ref(false);

/** 微信小程序按天路径动画：节流 polyline 更新，避免渲染层崩溃 */
const MP_POLYLINE_UPDATE_INTERVAL_MS = 150;

let animationController: ReturnType<typeof createRoutePathAnimation> | null = null;
let mapReadyTimer: ReturnType<typeof setTimeout> | null = null;
let lastPolylineEmitAt = 0;

const anchorPoints = computed(() =>
  props.routePath ? getRoutePathAnchorPoints(props.routePath) : [],
);

const mapCenter = computed(() => resolveRouteMapCenter(anchorPoints.value));

const mapIncludePoints = computed(() => {
  if (!mapReady.value) return undefined;
  const points = buildRouteIncludePoints(anchorPoints.value);
  return points.length >= 2 ? points : undefined;
});

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
  if (!props.routePath) return '';
  const hints: string[] = [];
  if (props.routePath.hiddenSpotCount > 0) {
    hints.push(tf('routeMap.hiddenSpots', { count: props.routePath.hiddenSpotCount }));
  }
  const hasEstimated = props.routePath.segments.some((segment) => segment.estimated);
  if (hasEstimated) {
    hints.push(t('routeMap.estimatedSegments'));
  }
  return hints.join(' · ');
});

const fullscreenTitle = computed(() => {
  const parts: string[] = [t('routeMap.title')];
  if (props.routePath?.date) {
    parts.push(props.routePath.date);
  } else if (props.routePath?.name) {
    parts.push(props.routePath.name);
  }
  return parts.join(' · ');
});

function clearMapReadyTimer() {
  if (mapReadyTimer != null) {
    clearTimeout(mapReadyTimer);
    mapReadyTimer = null;
  }
}

function scheduleMapReady() {
  clearMapReadyTimer();
  mapReady.value = false;
  const delayMs = mpWeixinMap ? 80 : 0;
  mapReadyTimer = setTimeout(() => {
    mapReadyTimer = null;
    mapReady.value = true;
  }, delayMs);
}

function destroyAnimation() {
  animationController?.destroy();
  animationController = null;
  playing.value = false;
}

function setupAnimation() {
  destroyAnimation();
  clearMapReadyTimer();
  mapReady.value = false;

  if (!props.routePath || props.routePath.fullPoints.length < 2) {
    animatedPolylinePoints.value = [];
    travelerPoint.value = null;
    return;
  }

  const fullPoints = simplifyMapPolylinePoints(props.routePath.fullPoints);
  mapScale.value = clampMapScale(mapCenter.value.scale);
  lastPolylineEmitAt = 0;

  animatedPolylinePoints.value = [fullPoints[0]!];
  travelerPoint.value = fullPoints[0]!;
  scheduleMapReady();

  animationController = createRoutePathAnimation({
    fullPoints,
    durationMs: props.durationMs,
    onPolylineUpdate(points) {
      const now = Date.now();
      if (mpWeixinMap && now - lastPolylineEmitAt < MP_POLYLINE_UPDATE_INTERVAL_MS) {
        return;
      }
      lastPolylineEmitAt = now;
      animatedPolylinePoints.value = simplifyMapPolylinePoints(points);
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

function openFullscreen() {
  if (!props.routePath || !mapReady.value) return;
  isFullscreen.value = true;
  scheduleMapReady();
}

function closeFullscreen() {
  isFullscreen.value = false;
  scheduleMapReady();
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
    if (isFullscreen.value) {
      isFullscreen.value = false;
    }
    setupAnimation();
  },
  { immediate: true },
);

onUnmounted(() => {
  isFullscreen.value = false;
  clearMapReadyTimer();
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

.map-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.map-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
  flex: 1;
  min-width: 0;
}

.map-date {
  font-size: 24rpx;
  color: #1677ff;
  flex-shrink: 0;
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

.map-wrap--fullscreen {
  flex: 1;
  height: auto;
  min-height: 0;
  border-radius: 0;
}

.map {
  width: 100%;
  height: 100%;
}

.controls,
.map-fullscreen-controls {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.map-fullscreen-controls {
  flex-shrink: 0;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1rpx solid #e5e7eb;
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

.map-fullscreen-root {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.map-fullscreen-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: calc(16rpx + env(safe-area-inset-top)) 24rpx 16rpx;
  background: #fff;
  border-bottom: 1rpx solid #e5e7eb;
}

.map-fullscreen-title {
  flex: 1;
  min-width: 0;
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
}
</style>

<!-- cover-view 在 map 内，样式需非 scoped -->
<style>
.map-overlay-tools {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  z-index: 9;
}

.map-overlay-tools--fullscreen {
  top: calc(16rpx + env(safe-area-inset-top));
  right: 24rpx;
}

.map-tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10rpx 20rpx;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 999rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.12);
}

.map-tool-btn--overlay {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  z-index: 9;
}

.map-tool-btn--header {
  position: static;
  flex-shrink: 0;
}

.map-tool-btn--exit {
  background: rgba(17, 24, 39, 0.88);
}

.map-tool-btn--exit .map-tool-btn-text {
  color: #fff;
}

.map-tool-btn-text {
  font-size: 24rpx;
  color: #1677ff;
  line-height: 1.2;
}
</style>
