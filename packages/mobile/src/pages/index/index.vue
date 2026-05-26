<template>
  <view class="container tab-page">
    <view class="hero">
      <text class="logo">兜</text>
      <text class="title">{{ t('app.name') }}</text>
      <text class="subtitle">{{ t('home.subtitle') }}</text>
    </view>

    <view class="features">
      <view class="feature" @click="goPlan">
        <text class="icon">✨</text>
        <text class="label">{{ t('home.featurePlan') }}</text>
        <text class="hint">{{ t('home.featurePlanHint') }}</text>
      </view>
      <view class="feature" @click="goRoutes">
        <text class="icon">🗺️</text>
        <text class="label">{{ t('home.featureRoutes') }}</text>
        <text class="hint">{{ t('home.featureRoutesHint') }}</text>
      </view>
      <view class="feature" @click="goProfile">
        <text class="icon">🏅</text>
        <text class="label">{{ t('home.featureAchievements') }}</text>
        <text class="hint">{{ t('home.featureAchievementsHint') }}</text>
      </view>
    </view>

    <view class="card" v-if="user">
      <text class="welcome">{{ welcomeText }}</text>
    </view>
    <view class="card" v-else>
      <button class="btn" @click="goLogin">{{ t('home.loginCta') }}</button>
    </view>
    <DouxingTabBar :current="0" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { UserInfo } from '@douxing/shared';
import { getStoredUser } from '@/utils/request';
import DouxingTabBar from '@/components/douxing-tab-bar/DouxingTabBar.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';

const { t, tf } = useTf();
usePageTitle('nav.index');

const user = ref<UserInfo | null>(getStoredUser());

const welcomeText = computed(() => {
  if (!user.value) return '';
  return tf('home.welcome', { name: user.value.nickname || user.value.username });
});

onShow(() => {
  uni.hideTabBar({ animation: false });
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
