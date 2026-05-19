<template>
  <view class="container">
    <view class="hero">
      <text class="logo">兜</text>
      <text class="title">{{ APP_NAME }}</text>
      <text class="subtitle">AI 驱动 · 一句话生成专属旅行</text>
    </view>

    <view class="features">
      <view class="feature" @click="goPlan">
        <text class="icon">✨</text>
        <text class="label">智能规划</text>
        <text class="hint">描述需求，一键生成路线</text>
      </view>
      <view class="feature" @click="goRoutes">
        <text class="icon">🗺️</text>
        <text class="label">我的路线</text>
        <text class="hint">查看与管理行程</text>
      </view>
      <view class="feature" @click="goProfile">
        <text class="icon">🏅</text>
        <text class="label">成就打卡</text>
        <text class="hint">打卡解锁旅行成就</text>
      </view>
    </view>

    <view class="card" v-if="user">
      <text class="welcome">你好，{{ user.nickname || user.username }}</text>
    </view>
    <view class="card" v-else>
      <button class="btn" @click="goLogin">登录体验 MVP</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { APP_NAME } from '@douxing/shared';
import type { UserInfo } from '@douxing/shared';
import { getStoredUser } from '@/utils/request';

const user = ref<UserInfo | null>(getStoredUser());

onShow(() => {
  user.value = getStoredUser();
});

function goPlan() {
  uni.switchTab({ url: '/pages/plan/plan' });
}

function goRoutes() {
  uni.switchTab({ url: '/pages/routes/list' });
}

function goProfile() {
  uni.switchTab({ url: '/pages/profile/profile' });
}

function goLogin() {
  uni.navigateTo({ url: '/pages/login/login' });
}
</script>

<style scoped>
.container {
  padding: 32rpx;
  min-height: 100vh;
  background: #f5f7fa;
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 0 32rpx;
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
  font-size: 44rpx;
  font-weight: 600;
  margin-top: 24rpx;
}
.subtitle {
  color: #6b7280;
  margin-top: 8rpx;
  font-size: 26rpx;
}
.features {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 24rpx;
}
.feature {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}
.icon {
  font-size: 36rpx;
}
.label {
  font-size: 30rpx;
  font-weight: 600;
  margin-left: 12rpx;
}
.hint {
  display: block;
  color: #6b7280;
  font-size: 24rpx;
  margin-top: 8rpx;
  margin-left: 48rpx;
}
.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-top: 32rpx;
  text-align: center;
}
.welcome {
  font-size: 28rpx;
}
.btn {
  background: #1677ff;
  color: #fff;
}
</style>
