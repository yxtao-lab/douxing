<template>
  <view class="page tab-page" :class="themeClass">
    <view class="page-header">
      <view class="profile-hero">
        <view class="hero-bg" />
        <view class="hero-content">
          <view v-if="user" class="user-card" @click="goEdit">
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
              <text class="sub">{{ planQuotaText }}</text>
              <view v-if="user.interestTags?.length" class="tag-row">
                <text v-for="tag in user.interestTags" :key="tag" class="user-tag">{{ labelOf(tag) }}</text>
              </view>
            </view>
            <text class="edit-arrow">›</text>
          </view>

          <view v-else class="guest-block">
            <view class="guest-brand">
              <view class="logo-mark">
                <text class="logo-text">兜</text>
              </view>
              <view class="guest-copy">
                <text class="guest-title">{{ t('profile.guestTitle') }}</text>
                <text class="guest-desc">{{ t('profile.guestDesc') }}</text>
              </view>
            </view>
            <button class="btn-login" @click="goLogin">{{ t('profile.loginRegister') }}</button>
          </view>
        </view>
      </view>
    </view>

    <scroll-view :scroll-y="contentNeedsScroll" class="page-content" enable-back-to-top>
      <view class="page-body">
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
      </view>
    </scroll-view>

    <DouxingTabBar :current="3" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, getCurrentInstance } from 'vue';
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
import { useTheme } from '@/i18n/useTheme';
import { useInterestTagLabel } from '@/i18n/useInterestTagLabel';

const { t, tf } = useTf();
const { labelOf } = useInterestTagLabel();
const { showLocalePicker } = useLocale();
const { themeClass, showThemePicker } = useTheme();
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
const contentNeedsScroll = ref(false);
const pageProxy = getCurrentInstance()?.proxy;

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
  { key: 'checkins', icon: '📍', label: t('profile.gridCheckins'), bg: 'var(--dx-primary-light)', action: goCheckins },
  { key: 'albums', icon: '📷', label: t('profile.gridMyAlbum'), bg: '#fff0f6', needLogin: true, action: goMyAlbum },
  { key: 'map', icon: '🗺️', label: t('profile.gridMap'), bg: 'var(--dx-accent-soft)', needLogin: true, action: goCheckinMap },
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
  { key: 'language', icon: '🌐', label: t('profile.language'), bg: 'var(--dx-primary-light)', action: showLocalePicker },
  { key: 'theme', icon: '🎨', label: t('profile.theme'), bg: 'var(--dx-accent-soft)', action: showThemePicker },
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

function goMyAlbum() {
  uni.navigateTo({ url: '/pages/journey-albums/list' });
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
  void syncPageLayout();
}

function syncPageLayout() {
  void nextTick(() => {
    const query = uni.createSelectorQuery();
    if (pageProxy) {
      query.in(pageProxy);
    }
    query.select('.page-content').boundingClientRect();
    query.select('.page-body').boundingClientRect();
    query.exec((results) => {
      const container = results[0];
      const body = results[1];
      if (
        container &&
        body &&
        !Array.isArray(container) &&
        !Array.isArray(body) &&
        container.height > 0 &&
        body.height > 0
      ) {
        contentNeedsScroll.value = body.height > container.height + 2;
      }
    });
  });
}

onShow(async () => {
  uni.hideTabBar({ animation: false });
  user.value = getStoredUser();
  if (!user.value) {
    void syncPageLayout();
    return;
  }
  try {
    const fresh = await fetchCurrentUser();
    user.value = fresh;
    const token = uni.getStorageSync('douxing_token') as string;
    if (token) setAuth(token, fresh);
  } catch {
    /* 离线时沿用本地缓存 */
  }
  void syncPageLayout();
});

watch(user, () => {
  void syncPageLayout();
});
</script>

<style scoped>
.page {
  --page-gutter: 32rpx;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--dx-bg);
  box-sizing: border-box;
  overflow: hidden;
}
.page-header {
  flex-shrink: 0;
}
.page-content {
  flex: 1;
  height: 0;
  width: 100%;
}
.profile-hero {
  position: relative;
  padding: 28rpx var(--page-gutter) 32rpx;
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
.user-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.user-card:active {
  opacity: 0.92;
}
.guest-block {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}
.guest-brand {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.logo-mark {
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--dx-radius-lg);
  background: rgba(255, 255, 255, 0.22);
  border: 2rpx solid rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.logo-text {
  color: var(--dx-text-inverse);
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1;
}
.guest-copy {
  flex: 1;
  min-width: 0;
}
.guest-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--dx-text-inverse);
  line-height: 1.35;
}
.guest-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.45;
}
.avatar,
.avatar-img {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  flex-shrink: 0;
  border: 3rpx solid rgba(255, 255, 255, 0.45);
}
.avatar {
  line-height: 96rpx;
  text-align: center;
  background: rgba(255, 255, 255, 0.22);
  color: var(--dx-text-inverse);
  font-size: 40rpx;
  font-weight: 600;
}
.edit-arrow {
  color: rgba(255, 255, 255, 0.85);
  font-size: 40rpx;
  margin-left: auto;
  flex-shrink: 0;
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}
.user-tag {
  font-size: 22rpx;
  color: var(--dx-text-inverse);
  background: rgba(255, 255, 255, 0.18);
  border: 1rpx solid rgba(255, 255, 255, 0.28);
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
  font-weight: 700;
  color: var(--dx-text-inverse);
}
.member-badge {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 20rpx;
  padding: 4rpx 12rpx 4rpx 6rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.92);
}
.member-badge-text {
  line-height: 1.2;
}
.member-badge:active {
  opacity: 0.75;
}
.member-badge.free {
  color: var(--dx-text-secondary);
}
.member-badge.silver {
  color: #475569;
}
.member-badge.gold {
  color: #b45309;
}
.member-badge.vip {
  color: #7c3aed;
}
.sub {
  color: rgba(255, 255, 255, 0.88);
  font-size: 24rpx;
  margin-top: 8rpx;
  display: block;
}
.page-body {
  padding: 0 var(--page-gutter) 24rpx;
  box-sizing: border-box;
}
.section {
  margin-top: 24rpx;
}
.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
  margin-bottom: 16rpx;
  padding-left: 4rpx;
}
.grid-card {
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 24rpx 8rpx 8rpx;
  display: flex;
  flex-wrap: wrap;
  box-shadow: var(--dx-shadow-sm);
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
  border-radius: var(--dx-radius-lg);
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
  color: var(--dx-text);
  text-align: center;
}
.action-card {
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-shadow: var(--dx-shadow-sm);
}
.action-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: var(--dx-radius-md);
  font-size: 30rpx;
  font-weight: 500;
  border: none;
  background: var(--dx-bg);
  color: var(--dx-text);
}
.action-btn::after {
  border: none;
}
.action-btn.primary {
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
  box-shadow: var(--dx-shadow-md);
}
.action-btn.danger {
  background: var(--dx-surface);
  color: #ef4444;
  border: 2rpx solid #fecaca;
}
.btn-login {
  flex-shrink: 0;
  width: auto;
  min-width: 168rpx;
  padding: 0 28rpx;
  margin: 0;
  background: var(--dx-surface);
  color: var(--dx-primary);
  border-radius: var(--dx-radius-lg);
  font-size: 26rpx;
  font-weight: 600;
  height: 72rpx;
  line-height: 72rpx;
  border: none;
  box-shadow: var(--dx-shadow-md);
  white-space: nowrap;
}
.btn-login::after {
  border: none;
}
</style>
