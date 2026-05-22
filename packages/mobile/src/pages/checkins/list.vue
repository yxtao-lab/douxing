<template>
  <view class="page">
    <view class="toolbar">
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
        <text class="stats">{{ filteredList.length }} 条记录 · {{ totalPoints }} 积分</text>
        <text class="map-link" @click="goMap">地图足迹 ›</text>
      </view>
    </view>

    <view v-if="filteredList.length === 0" class="empty">该时段暂无打卡记录</view>
    <view v-for="item in filteredList" :key="item.id" class="card">
      <view class="card-head">
        <text class="place">{{ item.location.placeName || '未知地点' }}</text>
        <text class="points">+{{ item.pointsEarned }} 积分</text>
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
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import type { CheckInInfo } from '@douxing/shared';
import { fetchCheckIns } from '@/api/checkins';
import { getStoredUser } from '@/utils/request';
import {
  CHECKIN_TIME_RANGE_OPTIONS,
  type CheckInTimeRange,
  filterCheckInsByTimeRange,
  sumCheckInPoints,
  formatCheckInTime,
} from '@/utils/checkin-map';

const timeRangeOptions = CHECKIN_TIME_RANGE_OPTIONS;
const allList = ref<CheckInInfo[]>([]);
const timeRange = ref<CheckInTimeRange>('all');

const filteredList = computed(() => filterCheckInsByTimeRange(allList.value, timeRange.value));
const totalPoints = computed(() => sumCheckInPoints(filteredList.value));

function formatTime(iso: string) {
  return formatCheckInTime(iso);
}

function previewPhoto(photos: string[], index: number) {
  uni.previewImage({ urls: photos, current: photos[index] });
}

function goMap() {
  uni.navigateTo({ url: `/pages/checkins/map?range=${timeRange.value}` });
}

onLoad((query) => {
  const range = String(query?.range ?? '');
  if (timeRangeOptions.some((opt) => opt.key === range)) {
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
  padding: 0 0 24rpx;
  min-height: 100vh;
  background: #f5f7fa;
}
.toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 20rpx 24rpx 16rpx;
  background: #fff;
  border-bottom: 1rpx solid #eef0f3;
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
  color: #6b7280;
  background: #f3f4f6;
}
.filter-chip.active {
  color: #fff;
  background: #1677ff;
}
.toolbar-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12rpx;
}
.stats {
  font-size: 24rpx;
  color: #374151;
}
.map-link {
  font-size: 24rpx;
  color: #1677ff;
  font-weight: 500;
}
.empty {
  text-align: center;
  color: #9ca3af;
  padding: 80rpx 0;
}
.card {
  background: #fff;
  border-radius: 12rpx;
  padding: 28rpx;
  margin: 20rpx 24rpx 0;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
}
.place {
  font-size: 30rpx;
  font-weight: 500;
  flex: 1;
}
.points {
  font-size: 24rpx;
  color: #1677ff;
  font-weight: 600;
  white-space: nowrap;
}
.city {
  color: #374151;
  font-size: 24rpx;
  margin-top: 8rpx;
  display: block;
}
.time {
  color: #6b7280;
  font-size: 24rpx;
  margin-top: 8rpx;
  display: block;
}
.remark {
  color: #374151;
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
  border-radius: 8rpx;
}
</style>
