<template>
  <view class="page">
    <view v-if="list.length === 0" class="empty">暂无打卡记录</view>
    <view v-for="item in list" :key="item.id" class="card">
      <text class="place">{{ item.location.placeName || '未知地点' }}</text>
      <text class="time">{{ formatTime(item.checkedAt) }}</text>
      <text class="remark" v-if="item.remark">{{ item.remark }}</text>
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
.place {
  font-size: 30rpx;
  font-weight: 500;
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
</style>
