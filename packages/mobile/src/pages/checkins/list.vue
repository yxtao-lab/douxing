<template>
  <view class="page" :class="themeClass">
    <view class="page-hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <view class="header-brand">
          <view class="logo-mark">
            <text class="hero-emoji">📍</text>
          </view>
          <view class="header-copy">
            <text class="title">{{ t('nav.checkins') }}</text>
            <text class="hero-desc">{{ t('emptyState.checkinsDesc') }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="page-body">
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
        <view class="toolbar-actions">
          <text class="stats">{{ statsLine }}</text>
          <text class="map-link" @click="goMap">{{ t('checkins.mapLink') }}</text>
        </view>
      </view>

      <DouxingEmptyState
        v-if="filteredList.length === 0"
        variant="checkins"
        :title="t('checkins.listEmpty')"
        :description="t('emptyState.checkinsDesc')"
        :action-label="t('routes.goPlan')"
        @action="goPlan"
      />
      <view v-for="item in filteredList" :key="item.id" class="card">
        <view class="card-head">
          <text class="place">{{ placeLabel(item) }}</text>
          <text class="points">{{ pointsLabel(item.pointsEarned) }}</text>
        </view>
        <text class="city" v-if="item.city || item.cityCode">{{ item.city || item.cityCode }}</text>
        <text class="time">{{ formatTime(item.checkedAt) }}</text>
        <text class="remark" v-if="item.remark">{{ item.remark }}</text>
        <view v-if="item.photos.length > 0" class="photos">
          <image
            v-for="(photo, idx) in item.photos"
            :key="idx"
            :src="photo"
            class="photo"
            mode="aspectFill"
            @click="previewPhoto(item.photos, idx)"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import type { CheckInInfo } from '@douxing/shared';
import { fetchCheckIns } from '@/api/checkins';
import { getStoredUser } from '@/utils/request';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';
import {
  CHECKIN_TIME_RANGE_OPTIONS,
  type CheckInTimeRange,
  filterCheckInsByTimeRange,
  sumCheckInPoints,
  formatCheckInTime,
} from '@/utils/checkin-map';

usePageTitle('nav.checkins');
const { t, tf } = useTf();
const { themeClass } = useTheme();

const timeRangeOptions = computed(() =>
  CHECKIN_TIME_RANGE_OPTIONS.map((opt) => ({
    key: opt.key,
    label: t(opt.labelKey),
  })),
);
const allList = ref<CheckInInfo[]>([]);
const timeRange = ref<CheckInTimeRange>('all');

const filteredList = computed(() => filterCheckInsByTimeRange(allList.value, timeRange.value));
const totalPoints = computed(() => sumCheckInPoints(filteredList.value));
const statsLine = computed(() =>
  tf('checkins.statsLine', { count: filteredList.value.length, points: totalPoints.value }),
);

function placeLabel(item: CheckInInfo) {
  return item.location.placeName || t('common.unknownPlace');
}

function pointsLabel(points: number) {
  return tf('checkins.pointsEarned', { points });
}

function formatTime(iso: string) {
  return formatCheckInTime(iso);
}

function previewPhoto(photos: string[], index: number) {
  uni.previewImage({ urls: photos, current: photos[index] });
}

function goMap() {
  uni.navigateTo({ url: `/pages/checkins/map?range=${timeRange.value}` });
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
  try {
    allList.value = await fetchCheckIns();
  } catch {
    allList.value = [];
  }
});
</script>

<style scoped>
.page {
  --page-gutter: 32rpx;
  min-height: 100vh;
  background: var(--dx-bg);
  box-sizing: border-box;
}
.page-hero {
  position: relative;
  padding: 24rpx var(--page-gutter) 28rpx;
  overflow: hidden;
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
  align-items: flex-start;
  gap: 16rpx;
}
.logo-mark {
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--dx-radius-md);
  background: rgba(255, 255, 255, 0.2);
  border: 2rpx solid rgba(255, 255, 255, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.hero-emoji {
  font-size: 32rpx;
  line-height: 1;
}
.header-copy {
  flex: 1;
  min-width: 0;
}
.title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: var(--dx-text-inverse);
  line-height: 1.35;
}
.hero-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.45;
}
.page-body {
  padding: 0 var(--page-gutter) 32rpx;
}
.filter-panel {
  margin-bottom: 20rpx;
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
.toolbar-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12rpx;
}
.stats {
  font-size: 24rpx;
  color: var(--dx-text);
}
.map-link {
  font-size: 24rpx;
  color: var(--dx-primary);
  font-weight: 500;
}
.card {
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: var(--dx-shadow-sm);
}
.card:last-child {
  margin-bottom: 0;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
}
.place {
  font-size: 30rpx;
  font-weight: 600;
  flex: 1;
  color: var(--dx-text);
}
.points {
  font-size: 24rpx;
  color: var(--dx-primary);
  font-weight: 600;
  white-space: nowrap;
}
.city {
  color: var(--dx-text);
  font-size: 24rpx;
  margin-top: 8rpx;
  display: block;
}
.time {
  color: var(--dx-text-secondary);
  font-size: 24rpx;
  margin-top: 8rpx;
  display: block;
}
.remark {
  color: var(--dx-text);
  font-size: 26rpx;
  margin-top: 8rpx;
  display: block;
}
.photos {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}
.photo {
  width: 160rpx;
  height: 160rpx;
  border-radius: var(--dx-radius-sm);
}
</style>
