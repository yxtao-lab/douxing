<template>
  <view class="page">
    <view class="user-card" v-if="user">
      <view class="avatar">{{ avatarText }}</view>
      <view class="info">
        <text class="name">{{ user.nickname || user.username }}</text>
        <text class="sub">@{{ user.username }}</text>
      </view>
    </view>
    <view class="user-card" v-else>
      <text>未登录</text>
      <button class="btn" @click="goLogin">登录 / 注册</button>
    </view>

    <view class="section">
      <text class="section-title">我的成就</text>
      <view v-if="achievements.length === 0" class="empty">打卡解锁成就</view>
      <view v-for="item in achievements" :key="item.id" class="achievement">
        <text class="badge">🏅</text>
        <view>
          <text class="a-title">{{ achievementLabel(item.achievementType) }}</text>
          <text class="a-desc">{{ item.description }}</text>
        </view>
      </view>
    </view>

    <view class="menu">
      <view class="menu-item" @click="goRoutes">我的路线</view>
      <view class="menu-item" @click="goCheckins">打卡记录</view>
      <view class="menu-item" v-if="user" @click="handleLogout">退出登录</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { UserInfo, AchievementInfo } from '@douxing/shared';
import { AchievementType } from '@douxing/shared';
import { fetchAchievements } from '@/api/achievements';
import { getStoredUser } from '@/utils/request';

const user = ref<UserInfo | null>(getStoredUser());
const achievements = ref<AchievementInfo[]>([]);

const avatarText = computed(() => (user.value?.nickname || user.value?.username || '?').slice(0, 1));

function achievementLabel(type: string) {
  const map: Record<string, string> = {
    [AchievementType.FIRST_CHECKIN]: '初行者',
    [AchievementType.EXPLORER]: '探索达人',
    [AchievementType.ROUTE_MASTER]: '路线大师',
  };
  return map[type] ?? type;
}

function goLogin() {
  uni.navigateTo({ url: '/pages/login/login' });
}

function goRoutes() {
  uni.switchTab({ url: '/pages/routes/list' });
}

function goCheckins() {
  uni.navigateTo({ url: '/pages/checkins/list' });
}

function handleLogout() {
  uni.removeStorageSync('douxing_token');
  uni.removeStorageSync('douxing_user');
  user.value = null;
  achievements.value = [];
  uni.showToast({ title: '已退出', icon: 'none' });
}

onShow(async () => {
  user.value = getStoredUser();
  if (!user.value) return;
  try {
    achievements.value = await fetchAchievements();
  } catch {
    achievements.value = [];
  }
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
}
.user-card {
  background: #fff;
  padding: 48rpx 32rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.avatar {
  width: 96rpx;
  height: 96rpx;
  line-height: 96rpx;
  text-align: center;
  background: #1677ff;
  color: #fff;
  border-radius: 50%;
  font-size: 40rpx;
}
.name {
  font-size: 34rpx;
  font-weight: 600;
  display: block;
}
.sub {
  color: #6b7280;
  font-size: 24rpx;
}
.section {
  margin: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
}
.section-title {
  font-weight: 600;
  font-size: 30rpx;
  display: block;
  margin-bottom: 20rpx;
}
.empty {
  color: #9ca3af;
  font-size: 26rpx;
}
.achievement {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 0;
  border-top: 1rpx solid #f3f4f6;
}
.badge {
  font-size: 40rpx;
}
.a-title {
  font-size: 28rpx;
  font-weight: 500;
  display: block;
}
.a-desc {
  color: #6b7280;
  font-size: 24rpx;
}
.menu {
  margin: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}
.menu-item {
  padding: 32rpx;
  border-bottom: 1rpx solid #f3f4f6;
  font-size: 30rpx;
}
.btn {
  margin-top: 16rpx;
  background: #1677ff;
  color: #fff;
}
</style>
