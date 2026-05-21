<template>
  <view class="page">
    <view v-if="list.length === 0" class="empty">暂无打卡记录</view>
    <view v-for="item in list" :key="item.id" class="card">
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
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { CheckInInfo } from '@douxing/shared';
import { fetchCheckIns } from '@/api/checkins';
import { getStoredUser } from '@/utils/request';

const list = ref<CheckInInfo[]>([]);

function formatTime(iso: string) {
  return iso.replace('T', ' ').slice(0, 16);
}

function previewPhoto(photos: string[], index: number) {
  uni.previewImage({ urls: photos, current: photos[index] });
}

onShow(async () => {
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  try {
    list.value = await fetchCheckIns();
  } catch {
    list.value = [];
  }
});
</script>

<style scoped>
.page {
  padding: 24rpx;
  min-height: 100vh;
  background: #f5f7fa;
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
  margin-bottom: 20rpx;
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
