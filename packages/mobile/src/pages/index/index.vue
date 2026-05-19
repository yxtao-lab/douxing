<template>
  <view class="container">
    <view class="hero">
      <text class="logo">兜</text>
      <text class="title">{{ APP_NAME }}</text>
      <text class="subtitle">智慧出行，一路随行</text>
    </view>
    <view class="card" v-if="user">
      <text class="label">当前用户</text>
      <text class="value">{{ user.nickname || user.username }}</text>
      <text class="roles">角色：{{ user.roles?.join('、') }}</text>
    </view>
    <view class="card" v-else>
      <text>未登录，请先登录</text>
      <button class="btn" @click="goLogin">去登录</button>
    </view>
    <view class="card" v-if="health">
      <text class="label">服务状态</text>
      <text class="value">{{ health.status }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { APP_NAME } from '@douxing/shared';
import type { UserInfo } from '@douxing/shared';
import { getStoredUser, request } from '@/utils/request';

const user = ref<UserInfo | null>(getStoredUser());
const health = ref<{ status: string } | null>(null);

onMounted(async () => {
  try {
    const data = await request<{ name: string; status: string }>('/health');
    health.value = data;
  } catch {
    /* ignore */
  }
});

function goLogin() {
  uni.navigateTo({ url: '/pages/login/login' });
}
</script>

<style scoped>
.container {
  padding: 32rpx;
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 0;
}
.logo {
  width: 96rpx;
  height: 96rpx;
  line-height: 96rpx;
  text-align: center;
  background: #1677ff;
  color: #fff;
  border-radius: 24rpx;
  font-size: 48rpx;
  font-weight: bold;
}
.title {
  font-size: 40rpx;
  font-weight: 600;
  margin-top: 24rpx;
}
.subtitle {
  color: #6b7280;
  margin-top: 8rpx;
}
.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
}
.label {
  display: block;
  color: #6b7280;
  font-size: 24rpx;
}
.value {
  display: block;
  font-size: 32rpx;
  margin-top: 8rpx;
}
.roles {
  display: block;
  color: #6b7280;
  font-size: 26rpx;
  margin-top: 8rpx;
}
.btn {
  margin-top: 24rpx;
  background: #1677ff;
  color: #fff;
}
</style>
