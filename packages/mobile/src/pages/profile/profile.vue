<template>
  <view class="page tab-page">
    <view class="user-card" v-if="user" @click="goEdit">
      <image v-if="user.avatar" class="avatar-img" :src="user.avatar" mode="aspectFill" />
      <view v-else class="avatar">{{ avatarText }}</view>
      <view class="info">
        <view class="name-row">
          <text class="name">{{ user.nickname || user.username }}</text>
          <text class="member-badge" :class="memberBadgeClass">{{ memberLevelLabel }}</text>
        </view>
        <text class="sub">@{{ user.username }} · 可生成 {{ planCandidateCount }} 套方案</text>
        <view v-if="user.interestTags?.length" class="tag-row">
          <text v-for="tag in user.interestTags" :key="tag" class="user-tag">{{ tag }}</text>
        </view>
      </view>
      <text class="edit-arrow">›</text>
    </view>
    <view class="user-card guest-card" v-else>
      <view class="guest-info">
        <text class="guest-title">登录兜行</text>
        <text class="guest-desc">解锁打卡、成就与排行榜</text>
      </view>
      <button class="btn-login" @click="goLogin">登录 / 注册</button>
    </view>

    <view class="section">
      <text class="section-title">个性化</text>
      <view class="grid-card">
        <view
          v-for="item in travelGridItems"
          :key="item.key"
          class="grid-item"
          @click="handleGridTap(item)"
        >
          <view class="grid-icon-wrap" :style="{ background: item.bg }">
            <text class="grid-icon">{{ item.icon }}</text>
          </view>
          <text class="grid-label">{{ item.label }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">账号与服务</text>
      <view class="action-card">
        <button
          v-for="action in userActions"
          :key="action.key"
          class="action-btn"
          :class="action.variant"
          @click="handleActionTap(action)"
        >
          {{ action.label }}
        </button>
        <button v-if="user" class="action-btn danger" @click="handleLogout">退出登录</button>
      </view>
    </view>

    <DouxingTabBar :current="3" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { UserInfo } from '@douxing/shared';
import { getMemberLevelLabel, getPlanCandidateCountByMemberLevel } from '@douxing/shared';
import { fetchCurrentUser } from '@/api/user';
import { getStoredUser, setAuth } from '@/utils/request';
import DouxingTabBar from '@/components/douxing-tab-bar/DouxingTabBar.vue';

interface GridItem {
  key: string;
  icon: string;
  label: string;
  bg: string;
  needLogin?: boolean;
  action: () => void;
}

interface UserAction {
  key: string;
  label: string;
  variant?: 'primary' | 'default';
  needLogin?: boolean;
  action: () => void;
}

const user = ref<UserInfo | null>(getStoredUser());

const avatarText = computed(() => (user.value?.nickname || user.value?.username || '?').slice(0, 1));

const memberLevelLabel = computed(() =>
  getMemberLevelLabel(user.value?.memberLevel),
);

const planCandidateCount = computed(() =>
  getPlanCandidateCountByMemberLevel(user.value?.memberLevel),
);

const memberBadgeClass = computed(() => {
  const level = user.value?.memberLevel ?? 0;
  if (level >= 3) return 'vip';
  if (level >= 2) return 'gold';
  if (level >= 1) return 'silver';
  return 'free';
});

const travelGridItems: GridItem[] = [
  { key: 'checkins', icon: '📍', label: '打卡记录', bg: '#e6f4ff', action: goCheckins },
  { key: 'map', icon: '🗺️', label: '打卡地图', bg: '#f0fdf4', needLogin: true, action: goCheckinMap },
  { key: 'achievements', icon: '🏅', label: '我的成就', bg: '#fff7e6', needLogin: true, action: goAchievements },
  { key: 'badges', icon: '🎖️', label: '我的徽章', bg: '#f9f0ff', needLogin: true, action: goBadges },
  { key: 'leaderboard', icon: '🏆', label: '排行榜', bg: '#fff1f0', needLogin: true, action: goLeaderboard },
];

const userActions: UserAction[] = [
  { key: 'edit', label: '编辑资料', variant: 'primary', needLogin: true, action: goEdit },
  { key: 'routes', label: '我的路线', action: goRoutes },
  { key: 'orders', label: '我的订单', needLogin: true, action: goOrders },
];

function requireLogin(then: () => void) {
  if (!user.value) {
    goLogin();
    return;
  }
  then();
}

function handleGridTap(item: GridItem) {
  if (item.needLogin) {
    requireLogin(item.action);
    return;
  }
  item.action();
}

function handleActionTap(action: UserAction) {
  if (action.needLogin) {
    requireLogin(action.action);
    return;
  }
  action.action();
}

function goLogin() {
  uni.navigateTo({ url: '/pages/login/login' });
}

function goEdit() {
  uni.navigateTo({ url: '/pages/profile/edit' });
}

function goRoutes() {
  uni.switchTab({ url: '/pages/routes/list' });
}

function goCheckins() {
  uni.navigateTo({ url: '/pages/checkins/list' });
}

function goBadges() {
  uni.navigateTo({ url: '/pages/badges/index' });
}

function goAchievements() {
  uni.navigateTo({ url: '/pages/achievements/index' });
}

function goLeaderboard() {
  uni.navigateTo({ url: '/pages/leaderboard/index' });
}

function goCheckinMap() {
  uni.navigateTo({ url: '/pages/checkins/map' });
}

function goOrders() {
  uni.navigateTo({ url: '/pages/orders/list' });
}

function handleLogout() {
  uni.removeStorageSync('douxing_token');
  uni.removeStorageSync('douxing_user');
  user.value = null;
  uni.showToast({ title: '已退出', icon: 'none' });
}

onShow(async () => {
  uni.hideTabBar({ animation: false });
  user.value = getStoredUser();
  if (!user.value) return;
  try {
    const fresh = await fetchCurrentUser();
    user.value = fresh;
    const token = uni.getStorageSync('douxing_token') as string;
    if (token) setAuth(token, fresh);
  } catch {
    /* 离线时沿用本地缓存 */
  }
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 24rpx;
}
.user-card {
  background: #fff;
  padding: 48rpx 32rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.guest-card {
  flex-direction: column;
  align-items: stretch;
  gap: 28rpx;
}
.guest-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.guest-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #111827;
}
.guest-desc {
  font-size: 24rpx;
  color: #6b7280;
}
.avatar,
.avatar-img {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  flex-shrink: 0;
}
.avatar {
  line-height: 96rpx;
  text-align: center;
  background: #1677ff;
  color: #fff;
  font-size: 40rpx;
}
.edit-arrow {
  color: #9ca3af;
  font-size: 40rpx;
  margin-left: auto;
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}
.user-tag {
  font-size: 22rpx;
  color: #1677ff;
  background: #e6f4ff;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
}
.info {
  flex: 1;
  min-width: 0;
}
.name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}
.name {
  font-size: 34rpx;
  font-weight: 600;
}
.member-badge {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
}
.member-badge.free {
  color: #6b7280;
  background: #f3f4f6;
}
.member-badge.silver {
  color: #475569;
  background: #e2e8f0;
}
.member-badge.gold {
  color: #b45309;
  background: #fef3c7;
}
.member-badge.vip {
  color: #7c3aed;
  background: #ede9fe;
}
.sub {
  color: #6b7280;
  font-size: 24rpx;
  margin-top: 8rpx;
  display: block;
}
.section {
  margin: 24rpx 24rpx 0;
}
.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #374151;
  margin-bottom: 16rpx;
  padding-left: 4rpx;
}
.grid-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 8rpx 8rpx;
  display: flex;
  flex-wrap: wrap;
}
.grid-item {
  width: 33.33%;
  box-sizing: border-box;
  padding: 16rpx 8rpx 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}
.grid-item:active {
  opacity: 0.75;
}
.grid-icon-wrap {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.grid-icon {
  font-size: 44rpx;
  line-height: 1;
}
.grid-label {
  font-size: 24rpx;
  color: #374151;
  text-align: center;
}
.action-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.action-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 500;
  border: none;
  background: #f3f4f6;
  color: #374151;
}
.action-btn::after {
  border: none;
}
.action-btn.primary {
  background: #1677ff;
  color: #fff;
}
.action-btn.danger {
  background: #fff;
  color: #ef4444;
  border: 1rpx solid #fecaca;
}
.btn-login {
  background: #1677ff;
  color: #fff;
  border-radius: 16rpx;
  font-size: 30rpx;
  height: 88rpx;
  line-height: 88rpx;
  border: none;
}
.btn-login::after {
  border: none;
}
</style>
