<template>
  <scroll-view scroll-y class="page tab-page" enable-back-to-top>
    <view class="hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <view class="brand-row">
          <view class="logo-mark">
            <text class="logo-text">兜</text>
          </view>
          <view class="brand-copy">
            <text class="brand-name">{{ t('app.name') }}</text>
            <text class="brand-sub">{{ t('home.subtitle') }}</text>
          </view>
        </view>
        <text class="tagline">{{ t('home.tagline') }}</text>
        <view class="value-props">
          <text v-for="item in valueProps" :key="item" class="value-chip">{{ item }}</text>
        </view>
        <button class="cta-primary" @click="goPlan">{{ t('home.ctaPlan') }}</button>
        <view v-if="user" class="welcome-bar">
          <text class="welcome-name">{{ welcomeText }}</text>
          <text class="welcome-sub">{{ t('home.welcomeSub') }}</text>
        </view>
        <view v-else class="guest-bar">
          <text class="guest-hint">{{ t('home.hotRoutesGuestHint') }}</text>
          <text class="guest-link" @click="goLogin">{{ t('home.ctaLogin') }}</text>
        </view>
      </view>
    </view>

    <view class="quick-actions">
      <view class="quick-item" @click="goPlan">
        <view class="quick-icon quick-icon--plan">✨</view>
        <text class="quick-label">{{ t('home.quickPlan') }}</text>
      </view>
      <view class="quick-item" @click="goRoutes">
        <view class="quick-icon quick-icon--routes">🗺️</view>
        <text class="quick-label">{{ t('home.quickRoutes') }}</text>
      </view>
      <view class="quick-item" @click="goProfile">
        <view class="quick-icon quick-icon--profile">🏅</view>
        <text class="quick-label">{{ t('home.quickProfile') }}</text>
      </view>
    </view>

    <view class="section hot-section">
      <view class="section-head">
        <text class="section-title">{{ t('home.hotRoutesTitle') }}</text>
        <text v-if="user && hotRoutes.length > 0" class="section-more" @click="goPlaza">
          {{ t('home.hotRoutesMore') }}
        </text>
      </view>

      <DouxingEmptyState
        v-if="!user"
        variant="plaza"
        embedded
        compact
        :title="t('home.hotRoutesGuestHint')"
        :action-label="t('home.ctaLogin')"
        @action="goLogin"
      />

      <DouxingEmptyState v-else-if="hotLoading" loading embedded compact />

      <DouxingEmptyState
        v-else-if="hotError"
        variant="error"
        embedded
        compact
        :title="hotError"
        :action-label="t('common.refresh')"
        @action="loadHotRoutes"
      />

      <DouxingEmptyState
        v-else-if="hotRoutes.length === 0"
        variant="plaza"
        embedded
        compact
        :title="t('home.hotRoutesEmpty')"
        :description="t('emptyState.routesPlazaDesc')"
        :action-label="t('home.ctaPlan')"
        @action="goPlan"
      />

      <scroll-view
        v-else
        scroll-x
        class="hot-scroll"
        :show-scrollbar="false"
      >
        <view class="hot-scroll-inner">
          <view
            v-for="item in hotRoutes"
            :key="item.id"
            class="hot-card"
            @click="goRouteDetail(item.id)"
          >
            <view class="hot-card-top">
              <text class="hot-name">{{ item.name }}</text>
              <text v-if="item.isAiGenerated" class="hot-ai-tag">AI</text>
            </view>
            <text class="hot-meta">{{ routeMeta(item) }}</text>
            <text class="hot-desc">{{ item.description || t('routes.noDescription') }}</text>
            <view class="hot-stats">
              <text class="hot-stat">👁 {{ item.viewCount ?? 0 }}</text>
              <text class="hot-stat">♥ {{ item.likeCount ?? 0 }}</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
    <DouxingTabBar :current="0" />
  </scroll-view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { TravelRouteInfo } from '@douxing/shared';
import { fetchPlazaRoutes } from '@/api/routes';
import { getStoredUser } from '@/utils/request';
import DouxingTabBar from '@/components/douxing-tab-bar/DouxingTabBar.vue';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';

const PLAZA_SCOPE_STORAGE_KEY = 'routes_initial_scope';

const { t, tf } = useTf();
usePageTitle('nav.index');

const user = ref(getStoredUser());
const hotRoutes = ref<TravelRouteInfo[]>([]);
const hotLoading = ref(false);
const hotError = ref('');

const valueProps = computed(() => [
  t('home.valueProp1'),
  t('home.valueProp2'),
  t('home.valueProp3'),
]);

const welcomeText = computed(() => {
  if (!user.value) return '';
  return tf('home.welcome', { name: user.value.nickname || user.value.username });
});

onShow(() => {
  uni.hideTabBar({ animation: false });
  user.value = getStoredUser();
  if (user.value) {
    void loadHotRoutes();
  } else {
    hotRoutes.value = [];
    hotError.value = '';
    hotLoading.value = false;
  }
});

async function loadHotRoutes() {
  hotLoading.value = true;
  hotError.value = '';
  try {
    hotRoutes.value = await fetchPlazaRoutes(8, 'hot');
  } catch (e) {
    hotRoutes.value = [];
    hotError.value = e instanceof Error ? e.message : t('home.hotRoutesLoadFailed');
  } finally {
    hotLoading.value = false;
  }
}

function routeMeta(item: TravelRouteInfo) {
  return tf('routes.cardMeta', {
    days: item.days,
    budget: item.budgetRange || t('routes.budgetTbd'),
  });
}

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

function goPlaza() {
  uni.setStorageSync(PLAZA_SCOPE_STORAGE_KEY, 'plaza');
  uni.switchTab({ url: '/pages/routes/list' });
}

function goRouteDetail(id: number) {
  uni.navigateTo({ url: `/pages/routes/detail?id=${id}` });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--dx-bg);
  box-sizing: border-box;
}

.hero {
  position: relative;
  padding: 24rpx 32rpx 0;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0 0 48rpx;
  background: var(--dx-gradient-hero);
  border-radius: 0 0 48rpx 48rpx;
  box-shadow: var(--dx-shadow-hero);
}

.hero-content {
  position: relative;
  z-index: 1;
  padding: 32rpx 8rpx 40rpx;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.logo-mark {
  width: 88rpx;
  height: 88rpx;
  border-radius: var(--dx-radius-lg);
  background: rgba(255, 255, 255, 0.22);
  border: 2rpx solid rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-text {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--dx-text-inverse);
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.brand-name {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--dx-text-inverse);
  letter-spacing: 2rpx;
}

.brand-sub {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.88);
}

.tagline {
  display: block;
  margin-top: 28rpx;
  font-size: 34rpx;
  font-weight: 600;
  line-height: 1.45;
  color: var(--dx-text-inverse);
}

.value-props {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 24rpx;
}

.value-chip {
  font-size: 22rpx;
  color: var(--dx-text-inverse);
  background: rgba(255, 255, 255, 0.18);
  border: 1rpx solid rgba(255, 255, 255, 0.28);
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
}

.cta-primary {
  margin-top: 32rpx;
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: var(--dx-surface);
  color: var(--dx-primary);
  font-size: 32rpx;
  font-weight: 600;
  border-radius: var(--dx-radius-lg);
  box-shadow: var(--dx-shadow-md);
  border: none;
}

.cta-primary::after {
  border: none;
}

.welcome-bar,
.guest-bar {
  margin-top: 24rpx;
  padding: 20rpx 24rpx;
  border-radius: var(--dx-radius-md);
  background: rgba(255, 255, 255, 0.14);
  border: 1rpx solid rgba(255, 255, 255, 0.22);
}

.welcome-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text-inverse);
}

.welcome-sub {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}

.guest-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.guest-hint {
  flex: 1;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.4;
}

.guest-link {
  flex-shrink: 0;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--dx-text-inverse);
  text-decoration: underline;
}

.quick-actions {
  display: flex;
  gap: 16rpx;
  padding: 8rpx 32rpx 0;
  margin-top: -8rpx;
}

.quick-item {
  flex: 1;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 24rpx 12rpx;
  text-align: center;
  box-shadow: var(--dx-shadow-sm);
}

.quick-icon {
  width: 72rpx;
  height: 72rpx;
  line-height: 72rpx;
  margin: 0 auto 12rpx;
  border-radius: var(--dx-radius-md);
  font-size: 34rpx;
  text-align: center;
}

.quick-icon--plan {
  background: var(--dx-primary-light);
}

.quick-icon--routes {
  background: var(--dx-accent-soft);
}

.quick-icon--profile {
  background: #fff7e6;
}

.quick-label {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--dx-text);
}

.section {
  padding: 32rpx;
  padding-bottom: calc(32rpx + 120rpx + env(safe-area-inset-bottom));
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--dx-text);
}

.section-more {
  font-size: 26rpx;
  color: var(--dx-primary);
  font-weight: 500;
}

.hot-scroll {
  width: 100%;
}

.hot-scroll-inner {
  display: flex;
  flex-direction: row;
  gap: 20rpx;
  padding: 4rpx 0 8rpx;
}

.hot-card {
  flex-shrink: 0;
  width: 480rpx;
  padding: 28rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  box-shadow: var(--dx-shadow-sm);
}

.hot-card-top {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.hot-name {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--dx-text);
  line-height: 1.35;
}

.hot-ai-tag {
  flex-shrink: 0;
  font-size: 20rpx;
  color: var(--dx-text-inverse);
  background: var(--dx-primary);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.hot-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--dx-primary);
}

.hot-desc {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: var(--dx-text-secondary);
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  display: -webkit-box;
}

.hot-stats {
  display: flex;
  gap: 20rpx;
  margin-top: 16rpx;
}

.hot-stat {
  font-size: 22rpx;
  color: var(--dx-text-muted);
}
</style>
