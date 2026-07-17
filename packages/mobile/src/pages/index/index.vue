<template>
  <view class="page tab-page" :class="themeClass">
    <view class="page-header">
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
    </view>

    <scroll-view :scroll-y="contentNeedsScroll" class="page-content" enable-back-to-top>
      <view class="page-body">
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

        <view class="section scene-section">
          <view class="section-head">
            <text class="section-title">{{ t('home.sceneExploreTitle') }}</text>
          </view>
          <scroll-view scroll-x class="scene-chips" show-scrollbar="false">
            <view class="scene-chips-inner">
              <view
                v-for="slug in sceneTagSlugs"
                :key="slug"
                class="scene-chip"
                @click="goScene(slug)"
              >
                <text class="scene-chip-emoji">{{ sceneEmoji(slug) }}</text>
                <text class="scene-chip-label">{{ sceneLabel(slug) }}</text>
              </view>
            </view>
          </scroll-view>
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

          <view v-else class="hot-carousel">
            <swiper
              class="hot-swiper"
              :style="hotSwiperStyle"
              :current="hotCurrent"
              :circular="hotRoutes.length > 1"
              previous-margin="72rpx"
              next-margin="72rpx"
              :duration="380"
              @change="onHotSwiperChange"
            >
              <swiper-item
                v-for="(item, index) in hotRoutes"
                :key="item.id"
                class="hot-swiper-item"
              >
                <view
                  class="hot-card"
                  :class="cardCarouselClass(index)"
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
              </swiper-item>
            </swiper>
            <view v-if="hotRoutes.length > 1" class="hot-dots">
              <view
                v-for="(_, index) in hotRoutes"
                :key="index"
                class="hot-dot"
                :class="{ active: index === hotCurrent }"
                @click="goHotSlide(index)"
              />
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <DouxingTabBar :current="0" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, getCurrentInstance } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { TravelRouteInfo } from '@douxing/shared';
import { normalizePaginatedItems, sceneTagPresets, formatSceneTagLabel, type SceneTagSlug } from '@douxing/shared';
import { fetchPlazaRoutes } from '@/api/routes';
import { getStoredUser, getAppErrorMessage } from '@/utils/request';
import { needsOnboarding } from '@douxing/shared';
import { fetchCurrentUser } from '@/api/user';
import { hideNativeTabBar } from '@/utils/hide-native-tab-bar';
import DouxingTabBar from '@/components/douxing-tab-bar/DouxingTabBar.vue';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';

const PLAZA_SCOPE_STORAGE_KEY = 'routes_initial_scope';

const { t, tf, locale } = useTf();
const { themeClass } = useTheme();
usePageTitle('nav.index');

const user = ref(getStoredUser());
const hotRoutes = ref<TravelRouteInfo[]>([]);
const hotLoading = ref(false);
const hotError = ref('');
const hotCurrent = ref(0);
const hotSwiperHeightPx = ref(0);
const contentNeedsScroll = ref(false);
const pageProxy = getCurrentInstance()?.proxy;

const hotSwiperStyle = computed(() =>
  hotSwiperHeightPx.value > 0 ? { height: `${hotSwiperHeightPx.value}px` } : {},
);

const valueProps = computed(() => [
  t('home.valueProp1'),
  t('home.valueProp2'),
  t('home.valueProp3'),
]);

const sceneTagSlugs = sceneTagPresets as SceneTagSlug[];

function sceneLabel(slug: SceneTagSlug) {
  return formatSceneTagLabel(slug, (locale.value ?? 'zh-CN') as 'zh-CN' | 'en-US');
}

const SCENE_EMOJI: Record<SceneTagSlug, string> = {
  kids: '👨‍👩‍👧',
  date: '💑',
  water: '💦',
  cool: '🍃',
  flower: '🌸',
  night: '🌃',
  'summer-escape': '🏔️',
  spring: '🌱',
  blessing: '🏮',
  camping: '⛺',
};

function sceneEmoji(slug: SceneTagSlug) {
  return SCENE_EMOJI[slug] ?? '✨';
}

function goScene(slug: SceneTagSlug) {
  uni.navigateTo({ url: `/pages/scenes/detail?slug=${encodeURIComponent(slug)}` });
}

const welcomeText = computed(() => {
  if (!user.value) return '';
  return tf('home.welcome', { name: user.value.nickname || user.value.username });
});

onShow(() => {
  hideNativeTabBar();
  user.value = getStoredUser();
  if (user.value && needsOnboarding(user.value.onboardedAt)) {
    uni.reLaunch({ url: '/pages/onboarding/guide' });
    return;
  }
  if (user.value) {
    void loadHotRoutes();
    void fetchCurrentUser()
      .then((fresh) => {
        user.value = fresh;
        if (needsOnboarding(fresh.onboardedAt)) {
          uni.reLaunch({ url: '/pages/onboarding/guide' });
        }
      })
      .catch(() => {
        /* 忽略刷新失败，继续展示缓存 */
      });
  } else {
    hotRoutes.value = [];
    hotError.value = '';
    hotLoading.value = false;
    void syncPageLayout();
  }
});

watch(user, () => {
  void syncPageLayout();
});

watch(hotRoutes, () => {
  hotCurrent.value = 0;
  void syncPageLayout();
});

watch(hotLoading, (loading) => {
  if (!loading) {
    void syncPageLayout();
  }
});

function syncPageLayout() {
  void nextTick(() => {
    const query = uni.createSelectorQuery();
    if (pageProxy) {
      query.in(pageProxy);
    }
    query.select('.page-content').boundingClientRect();
    query.select('.page-body').boundingClientRect();
    query.select('.hot-swiper-item .hot-card').boundingClientRect();
    query.exec((results) => {
      const container = results[0];
      const body = results[1];
      const card = results[2];

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

      if ((hotRoutes.value ?? []).length === 0) {
        hotSwiperHeightPx.value = 0;
        return;
      }
      if (card && !Array.isArray(card) && card.height > 0) {
        hotSwiperHeightPx.value = Math.ceil(card.height);
      }
    });
  });
}

async function loadHotRoutes() {
  hotLoading.value = true;
  hotError.value = '';
  try {
    const data = await fetchPlazaRoutes(8, 'hot');
    hotRoutes.value = normalizePaginatedItems(data);
  } catch (e) {
    hotRoutes.value = [];
    hotError.value = getAppErrorMessage(e, t('home.hotRoutesLoadFailed'));
  } finally {
    hotLoading.value = false;
    void syncPageLayout();
  }
}

function onHotSwiperChange(e: { detail: { current: number } }) {
  hotCurrent.value = e.detail.current;
}

function goHotSlide(index: number) {
  hotCurrent.value = index;
}

function cardCarouselClass(index: number) {
  const total = (hotRoutes.value ?? []).length;
  if (total <= 1) return ['hot-card--active'];

  const current = hotCurrent.value;
  let diff = index - current;
  const half = total / 2;
  if (diff > half) diff -= total;
  if (diff < -half) diff += total;

  if (diff === 0) return ['hot-card--active'];
  if (diff === 1) return ['hot-card--side', 'hot-card--next'];
  if (diff === -1) return ['hot-card--side', 'hot-card--prev'];
  return ['hot-card--far'];
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

.page-body {
  padding: 0 var(--page-gutter) 24rpx;
  box-sizing: border-box;
}

.hero {
  position: relative;
  padding: 24rpx var(--page-gutter) 0;
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
  padding-top: 8rpx;
  margin-top: -24rpx;
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
  padding-top: 32rpx;
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

.scene-chips {
  width: 100%;
  white-space: nowrap;
}

.scene-chips-inner {
  display: inline-flex;
  gap: 16rpx;
  padding: 4rpx 0 8rpx;
}

.scene-chip {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  padding: 16rpx 24rpx;
  border-radius: 999rpx;
  background: var(--dx-surface);
  border: 1rpx solid var(--dx-border);
  box-shadow: var(--dx-shadow-sm);
}

.scene-chip-emoji {
  font-size: 32rpx;
  line-height: 1;
}

.scene-chip-label {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--dx-text);
}

.hot-carousel {
  margin: 0 -8rpx;
  padding: 8rpx 0 4rpx;
}

.hot-swiper {
  width: 100%;
  perspective: 1400rpx;
}

.hot-swiper-item {
  box-sizing: border-box;
  padding: 0 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.hot-card {
  flex-shrink: 0;
  width: 480rpx;
  padding: 28rpx;
  box-sizing: border-box;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-xl);
  border: 2rpx solid rgba(255, 255, 255, 0.65);
  box-shadow: var(--dx-shadow-sm);
  transform: scale(0.86) rotateY(10deg);
  transform-origin: center center;
  opacity: 0.55;
  filter: blur(3px);
  transition:
    transform 0.38s ease,
    opacity 0.38s ease,
    filter 0.38s ease,
    box-shadow 0.38s ease;
}

.hot-card--active {
  transform: scale(1) rotateY(0deg);
  opacity: 1;
  filter: none;
  z-index: 3;
  box-shadow: var(--dx-shadow-md);
  border-color: rgba(255, 255, 255, 0.95);
}

.hot-card--side {
  opacity: 0.78;
  filter: blur(1.5px);
  z-index: 2;
}

.hot-card--prev {
  transform: scale(0.9) rotateY(8deg);
  transform-origin: right center;
}

.hot-card--next {
  transform: scale(0.9) rotateY(-8deg);
  transform-origin: left center;
}

.hot-card--far {
  transform: scale(0.82) rotateY(0deg);
  opacity: 0.4;
  filter: blur(4px);
  z-index: 1;
}

.hot-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  margin-top: 20rpx;
}

.hot-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 999rpx;
  background: var(--dx-border);
  transition: width 0.28s ease, background 0.28s ease;
}

.hot-dot.active {
  width: 28rpx;
  background: var(--dx-primary);
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
