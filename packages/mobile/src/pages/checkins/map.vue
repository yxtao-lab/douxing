<template>
  <view class="page" :class="themeClass">
    <view class="page-hero page-hero--compact">
      <view class="hero-bg" />
      <view class="hero-content">
        <view class="header-brand">
          <view class="logo-mark">
            <text class="hero-emoji">🗺️</text>
          </view>
          <view class="header-copy">
            <text class="title">{{ t('nav.checkinMap') }}</text>
            <text class="hero-desc">{{ footprintStats }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="filter-panel">
      <scroll-view scroll-x class="filters" :show-scrollbar="false">
        <view
          v-for="opt in timeRangeOptions"
          :key="opt.key"
          class="filter-chip"
          :class="{ active: timeRange === opt.key }"
          @click="timeRange = opt.key"
        >
          {{ opt.label }}
        </view>
      </scroll-view>
      <view class="stats-block">
        <text class="stats">{{ totalPoints }} {{ t('common.points') }}</text>
        <text v-if="hiddenCount > 0" class="hint">{{ hiddenHint }}</text>
      </view>
    </view>

    <view class="map-wrap">
      <map
        id="checkinMap"
        class="map"
        :latitude="displayCenter.latitude"
        :longitude="displayCenter.longitude"
        :scale="mapScale"
        :markers="displayMarkers"
        :polyline="polyline"
        :include-points="includePoints"
        show-location
        enable-zoom
        enable-scroll
        @markertap="handleMarkerTap"
        @regionchange="handleRegionChange"
      >
        <!-- #ifdef MP-WEIXIN -->
        <cover-view slot="callout">
          <cover-view
            v-for="marker in photoCalloutMarkers"
            :key="marker.id"
            :marker-id="marker.id"
            class="photo-callout"
            :class="{ active: selectedId === marker.id }"
          >
            <cover-image
              :src="marker.photoUrl!"
              class="photo-callout-img"
              @tap="handlePhotoCalloutTap(marker.id)"
            />
            <cover-view class="photo-callout-arrow" />
          </cover-view>
        </cover-view>
        <!-- #endif -->
      </map>
      <view v-if="filteredList.length === 0" class="map-empty">
        <DouxingEmptyState
          variant="map"
          compact
          embedded
          :title="t('checkins.mapEmpty')"
          :description="t('emptyState.checkinsMapDesc')"
          :action-label="t('routes.goPlan')"
          @action="goPlan"
        />
      </view>
    </view>

    <view v-if="selectedItem" class="detail-card">
      <view class="detail-head">
        <text class="detail-place">{{ placeLabel(selectedItem) }}</text>
        <text class="detail-points">{{ pointsLabel(selectedItem.pointsEarned) }}</text>
      </view>
      <text class="detail-meta">
        {{ cityLabel(selectedItem) }} · {{ formatTime(selectedItem.checkedAt) }}
      </text>
      <text v-if="selectedItem.remark" class="detail-remark">{{ selectedItem.remark }}</text>
      <view v-if="selectedItem.photos.length > 0" class="detail-photos">
        <image
          v-for="(photo, idx) in selectedItem.photos"
          :key="idx"
          :src="photo"
          class="detail-photo"
          mode="aspectFill"
          @click="previewPhoto(selectedItem.photos, idx)"
        />
      </view>
    </view>

    <scroll-view scroll-y class="timeline" :class="{ compact: !!selectedItem }">
      <DouxingEmptyState
        v-if="filteredList.length === 0"
        variant="checkins"
        compact
        :title="t('checkins.timelineEmpty')"
        :action-label="t('routes.goPlan')"
        @action="goPlan"
      />
      <view
        v-for="item in filteredList"
        :key="item.id"
        class="timeline-item"
        :class="{ active: selectedId === item.id }"
        @click="focusCheckIn(item)"
      >
        <view class="timeline-dot" />
        <view class="timeline-body">
          <text class="timeline-place">{{ placeLabel(item) }}</text>
          <text class="timeline-meta">{{ timelineMeta(item) }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="footer-actions">
      <button
        class="btn-primary"
        :disabled="filteredList.length === 0"
        @click="openPoster"
      >
        {{ t('checkins.posterAction') }}
      </button>
      <button class="btn-secondary" @click="goList">{{ t('common.listView') }}</button>
    </view>
    <CheckInPosterSheet
      :visible="posterVisible"
      :checkins="filteredList"
      @close="posterVisible = false"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import type { CheckInInfo } from '@douxing/shared';
import { fetchCheckIns } from '@/api/checkins';
import { getStoredUser } from '@/utils/request';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';
import CheckInPosterSheet from '@/components/checkin-poster/CheckInPosterSheet.vue';
import {
  CHECKIN_TIME_RANGE_OPTIONS,
  type CheckInTimeRange,
  filterCheckInsByTimeRange,
  buildMapMarkers,
  buildMapMarkersWithPhotoIcon,
  getPhotoCalloutMarkers,
  buildMapPolyline,
  buildIncludePoints,
  resolveMapCenter,
  sumCheckInPoints,
  formatCheckInTime,
  getCheckInsWithCoords,
} from '@/utils/checkin-map';

usePageTitle('nav.checkinMap');
const { t, tf } = useTf();
const { themeClass } = useTheme();

const isMpWeixin = process.env.UNI_PLATFORM === 'mp-weixin';

const timeRangeOptions = computed(() =>
  CHECKIN_TIME_RANGE_OPTIONS.map((opt) => ({
    key: opt.key,
    label: t(opt.labelKey),
  })),
);
const allList = ref<CheckInInfo[]>([]);
const timeRange = ref<CheckInTimeRange>('all');
const selectedId = ref<number | null>(null);
const posterVisible = ref(false);
const mapScale = ref(10);
const userMovedMap = ref(false);
const overrideCenter = ref<{ latitude: number; longitude: number } | null>(null);

const filteredList = computed(() => filterCheckInsByTimeRange(allList.value, timeRange.value));
const totalPoints = computed(() => sumCheckInPoints(filteredList.value));
const footprintStats = computed(() =>
  tf('checkins.footprintCount', { count: filteredList.value.length }),
);
const hiddenHint = computed(() =>
  hiddenCount.value > 0 ? tf('checkins.hiddenNoCoords', { count: hiddenCount.value }) : '',
);
const markers = computed(() => buildMapMarkers(filteredList.value));
const displayMarkers = computed(() =>
  isMpWeixin ? markers.value : buildMapMarkersWithPhotoIcon(filteredList.value),
);
const photoCalloutMarkers = computed(() => getPhotoCalloutMarkers(markers.value));
const { themeId } = useTheme();
const polyline = computed(() => {
  void themeId.value;
  return buildMapPolyline(filteredList.value);
});
const includePoints = computed(() => buildIncludePoints(filteredList.value));
const hiddenCount = computed(
  () => filteredList.value.length - getCheckInsWithCoords(filteredList.value).length,
);

const mapCenter = computed(() => resolveMapCenter(filteredList.value));

const displayCenter = computed(() => {
  if (overrideCenter.value) return overrideCenter.value;
  return {
    latitude: mapCenter.value.latitude,
    longitude: mapCenter.value.longitude,
  };
});

const selectedItem = computed(() =>
  selectedId.value == null
    ? null
    : filteredList.value.find((item) => item.id === selectedId.value) ?? null,
);

function placeLabel(item: CheckInInfo) {
  return item.location.placeName || t('common.unknownPlace');
}

function cityLabel(item: CheckInInfo) {
  return item.city || item.cityCode || t('common.unknownCity');
}

function pointsLabel(points: number) {
  return tf('checkins.pointsEarned', { points });
}

function timelineMeta(item: CheckInInfo) {
  return tf('checkins.timelineMeta', {
    time: formatTime(item.checkedAt),
    points: item.pointsEarned,
  });
}

function formatTime(iso: string) {
  return formatCheckInTime(iso);
}

function previewPhoto(photos: string[], index: number) {
  uni.previewImage({ urls: photos, current: photos[index] });
}

function handleMarkerTap(event: { detail: { markerId: number } }) {
  selectedId.value = event.detail.markerId;
}

function handlePhotoCalloutTap(markerId: number) {
  selectedId.value = markerId;
  const item = filteredList.value.find((row) => row.id === markerId);
  if (item?.photos.length) {
    previewPhoto(item.photos, 0);
  }
}

function handleRegionChange(event: { detail?: { type?: string } }) {
  if (event.detail?.type === 'end') {
    userMovedMap.value = true;
  }
}

function focusCheckIn(item: CheckInInfo) {
  selectedId.value = item.id;
  if (item.location.latitude != null && item.location.longitude != null) {
    userMovedMap.value = false;
    overrideCenter.value = {
      latitude: item.location.latitude,
      longitude: item.location.longitude,
    };
    mapScale.value = 15;
  }
}

watch(timeRange, () => {
  selectedId.value = null;
  userMovedMap.value = false;
  overrideCenter.value = null;
  mapScale.value = mapCenter.value.scale;
});

watch(
  () => mapCenter.value.scale,
  (scale) => {
    if (!userMovedMap.value) {
      mapScale.value = scale;
    }
  },
);

async function loadCheckIns() {
  try {
    allList.value = await fetchCheckIns();
  } catch {
    allList.value = [];
  }
}


function goList() {
  uni.navigateTo({ url: `/pages/checkins/list?range=${timeRange.value}` });
}

function openPoster() {
  posterVisible.value = true;
}

function goPlan() {
  uni.switchTab({ url: '/pages/plan/plan' });
}


onLoad((query) => {
  const range = String(query?.range ?? '');
  if (CHECKIN_TIME_RANGE_OPTIONS.some((opt) => opt.key === range)) {
    timeRange.value = range as CheckInTimeRange;
  }
});

onShow(async () => {
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  await loadCheckIns();
  if (filteredList.value.length > 0 && selectedId.value == null) {
    selectedId.value = filteredList.value[0]!.id;
  }
});
</script>

<style scoped>
.page {
  --page-gutter: 32rpx;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--dx-bg);
}
.page-hero {
  position: relative;
  flex-shrink: 0;
  padding: 20rpx var(--page-gutter) 24rpx;
  overflow: hidden;
}
.page-hero--compact .title {
  font-size: 32rpx;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--dx-gradient-hero);
  border-radius: 0 0 var(--dx-radius-xl) var(--dx-radius-xl);
  box-shadow: var(--dx-shadow-hero);
}
.hero-content {
  position: relative;
  z-index: 1;
}
.header-brand {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.logo-mark {
  width: 56rpx;
  height: 56rpx;
  border-radius: var(--dx-radius-md);
  background: rgba(255, 255, 255, 0.2);
  border: 2rpx solid rgba(255, 255, 255, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.hero-emoji {
  font-size: 28rpx;
  line-height: 1;
}
.header-copy {
  flex: 1;
  min-width: 0;
}
.title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--dx-text-inverse);
  line-height: 1.35;
}
.hero-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.88);
}
.filter-panel {
  flex-shrink: 0;
  margin: 0 var(--page-gutter) 12rpx;
  padding: 16rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  box-shadow: var(--dx-shadow-sm);
}
.filters {
  white-space: nowrap;
}
.filter-chip {
  display: inline-block;
  padding: 10rpx 24rpx;
  margin-right: 12rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: var(--dx-text-secondary);
  background: var(--dx-bg);
}
.filter-chip.active {
  color: var(--dx-text-inverse);
  background: var(--dx-primary);
}
.stats-block {
  margin-top: 12rpx;
}
.stats {
  display: block;
  font-size: 24rpx;
  color: var(--dx-text);
}
.hint {
  display: block;
  margin-top: 4rpx;
  color: var(--dx-text-muted);
  font-size: 22rpx;
}
.map-wrap {
  position: relative;
  height: 52vh;
  min-height: 420rpx;
}
.map {
  width: 100%;
  height: 100%;
}
.map-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx;
  box-sizing: border-box;
  pointer-events: auto;
}
.detail-card {
  margin: 16rpx var(--page-gutter) 0;
  padding: 24rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  box-shadow: var(--dx-shadow-md);
}
.detail-head {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}
.detail-place {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--dx-text);
  flex: 1;
}
.detail-points {
  font-size: 24rpx;
  color: var(--dx-primary);
  font-weight: 600;
}
.detail-meta,
.detail-remark {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--dx-text-secondary);
}
.detail-photos {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}
.detail-photo {
  width: 120rpx;
  height: 120rpx;
  border-radius: var(--dx-radius-sm);
}
.timeline {
  flex: 1;
  padding: 16rpx var(--page-gutter);
}
.timeline.compact {
  max-height: 220rpx;
}
.timeline-item {
  display: flex;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--dx-border);
}
.timeline-item.active .timeline-place {
  color: var(--dx-primary);
}
.timeline-dot {
  width: 16rpx;
  height: 16rpx;
  margin-top: 10rpx;
  border-radius: 50%;
  background: var(--dx-primary);
  flex-shrink: 0;
}
.timeline-body {
  flex: 1;
}
.timeline-place {
  display: block;
  font-size: 28rpx;
  color: var(--dx-text);
}
.timeline-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--dx-text-secondary);
}
.footer-actions {
  display: flex;
  gap: 16rpx;
  padding: 16rpx var(--page-gutter) calc(16rpx + env(safe-area-inset-bottom));
  background: var(--dx-surface);
  border-top: 1rpx solid var(--dx-border);
  flex-shrink: 0;
}
.btn-secondary,
.btn-primary {
  flex: 1;
  margin: 0;
  font-size: 28rpx;
  border-radius: var(--dx-radius-lg);
  border: none;
}
.btn-secondary::after,
.btn-primary::after {
  border: none;
}
.btn-secondary {
  background: var(--dx-bg);
  color: var(--dx-text);
}
.btn-primary {
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
  box-shadow: var(--dx-shadow-sm);
}
.btn-primary[disabled] {
  opacity: 0.45;
  color: var(--dx-text-inverse);
  background: var(--dx-primary);
}
</style>

<!-- cover-view 在 map 内，样式需非 scoped -->
<style>
.photo-callout {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.photo-callout-img {
  width: 52px;
  height: 52px;
  border-radius: 6px;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
  background: #f3f4f6;
}
.photo-callout.active .photo-callout-img {
  border-color: var(--dx-primary);
}
.photo-callout-arrow {
  width: 0;
  height: 0;
  margin-top: 2px;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid var(--dx-primary);
}
</style>
