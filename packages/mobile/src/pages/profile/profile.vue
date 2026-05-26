<template>
  <view class="page tab-page">
    <view class="user-card" v-if="user" @click="goEdit">
      <image v-if="user.avatar" class="avatar-img" :src="user.avatar" mode="aspectFill" />
      <view v-else class="avatar">{{ avatarText }}</view>
      <view class="info">
        <view class="name-row">
          <text class="name">{{ user.nickname || user.username }}</text>
          <view class="member-badge" :class="memberBadgeClass" @click.stop="goMembership">
            <MemberLevelIcon :level="user.memberLevel ?? 0" size="sm" />
            <text class="member-badge-text">{{ memberLevelLabel }}</text>
          </view>
        </view>
        <text class="sub">@{{ planQuotaText }}</text>
        <view v-if="user.interestTags?.length" class="tag-row">
          <text v-for="tag in user.interestTags" :key="tag" class="user-tag">{{ labelOf(tag) }}</text>
        </view>
      </view>
      <text class="edit-arrow">›</text>
    </view>
    <view class="user-card guest-card" v-else>
      <view class="guest-info">
        <text class="guest-title">{{ t('profile.guestTitle') }}</text>
        <text class="guest-desc">{{ t('profile.guestDesc') }}</text>
      </view>
      <button class="btn-login" @click="goLogin">{{ t('profile.loginRegister') }}</button>
    </view>

    <view class="section">
      <text class="section-title">{{ t('profile.sectionPersonalize') }}</text>
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
      <text class="section-title">{{ t('profile.sectionAccount') }}</text>
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
        <button v-if="user" class="action-btn danger" @click="handleLogout">{{ t('common.logout') }}</button>
      </view>
    </view>

    <DouxingTabBar :current="3" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { UserInfo } from '@douxing/shared';
import {
  getMemberLevelI18nKey,
  getMemberLevelBadgeClass,
  getPlanCandidateCountByMemberLevel,
  canAppendPlanByMemberLevel,
} from '@douxing/shared';
import MemberLevelIcon from '@/components/member-level-icon/MemberLevelIcon.vue';
import { fetchCurrentUser } from '@/api/user';
import { getStoredUser, setAuth } from '@/utils/request';
import DouxingTabBar from '@/components/douxing-tab-bar/DouxingTabBar.vue';
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';
import { useInterestTagLabel } from '@/i18n/useInterestTagLabel';

const { t, tf } = useTf();
const { labelOf } = useInterestTagLabel();
const { showLocalePicker } = useLocale();
usePageTitle('nav.profile');

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
  t(getMemberLevelI18nKey(user.value?.memberLevel)),
);

const planCandidateCount = computed(() =>
  getPlanCandidateCountByMemberLevel(user.value?.memberLevel),
);

const planQuotaText = computed(() => {
  if (!user.value) return '';
  const followUp = canAppendPlanByMemberLevel(user.value.memberLevel)
    ? t('profile.planQuotaFollowUpYes')
    : t('profile.planQuotaFollowUpNo');
  return tf('profile.planQuota', {
    username: user.value.username,
    count: planCandidateCount.value,
    followUp,
  });
});

const memberBadgeClass = computed(() => getMemberLevelBadgeClass(user.value?.memberLevel));

const travelGridItems = computed<GridItem[]>(() => [
  { key: 'checkins', icon: '📍', label: t('profile.gridCheckins'), bg: '#e6f4ff', action: goCheckins },
  { key: 'map', icon: '🗺️', label: t('profile.gridMap'), bg: '#f0fdf4', needLogin: true, action: goCheckinMap },
  {
    key: 'achievements',
    icon: '🏅',
    label: t('profile.gridAchievements'),
    bg: '#fff7e6',
    needLogin: true,
    action: goAchievements,
  },
  { key: 'badges', icon: '🎖️', label: t('profile.gridBadges'), bg: '#f9f0ff', needLogin: true, action: goBadges },
  {
    key: 'leaderboard',
    icon: '🏆',
    label: t('profile.gridLeaderboard'),
    bg: '#fff1f0',
    needLogin: true,
    action: goLeaderboard,
  },
  { key: 'language', icon: '🌐', label: t('profile.language'), bg: '#eef2ff', action: showLocalePicker },
]);

const userActions = computed<UserAction[]>(() => [
  { key: 'edit', label: t('profile.actionEdit'), variant: 'primary', needLogin: true, action: goEdit },
  { key: 'routes', label: t('profile.actionRoutes'), action: goRoutes },
  { key: 'orders', label: t('profile.actionOrders'), needLogin: true, action: goOrders },
]);

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

function goMembership() {
  if (!user.value) {
    goLogin();
    return;
  }
  uni.navigateTo({ url: '/pages/profile/membership' });
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
  uni.showToast({ title: t('common.logoutDone'), icon: 'none' });
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
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 20rpx;
  padding: 4rpx 12rpx 4rpx 6rpx;
  border-radius: 999rpx;
}
.member-badge-text {
  line-height: 1.2;
}
.member-badge:active {
  opacity: 0.75;
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
