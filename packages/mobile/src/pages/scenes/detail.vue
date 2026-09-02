<template>
  <view class="page" :class="themeClass">
    <view class="page-hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <text class="hero-emoji">{{ sceneEmoji }}</text>
        <text class="hero-title">{{ sceneLabel }}</text>
      </view>
    </view>

    <scroll-view scroll-y class="page-content" enable-back-to-top>
      <view class="page-body">
        <DouxingEmptyState v-if="loading" loading embedded :title="t('common.loading')" />

        <DouxingEmptyState
          v-else-if="error"
          variant="error"
          embedded
          :title="error"
          :action-label="t('common.refresh')"
          @action="loadDetail"
        />

        <template v-else>
          <view class="section section-panel">
            <view class="section-head">
              <view class="section-title-row">
                <text class="section-title">{{ t('scenes.attractionsTitle') }}</text>
                <text v-if="attractions.length > 0" class="section-badge">{{ t('scenes.attractionsTopBadge') }}</text>
              </view>
            </view>
            <DouxingEmptyState
              v-if="attractions.length === 0"
              embedded
              compact
              :title="t('scenes.attractionsEmpty')"
            />
            <scroll-view
              v-else
              scroll-x
              class="attraction-strip"
              :show-scrollbar="false"
              enable-flex
            >
              <view
                v-for="item in attractions"
                :key="item.id"
                class="attraction-chip"
                hover-class="attraction-chip--hover"
                @click="goAttraction(item.id)"
              >
                <image
                  v-if="item.coverImageUrl"
                  class="attraction-thumb"
                  :src="item.coverImageUrl"
                  mode="aspectFill"
                />
                <view v-else class="attraction-thumb attraction-thumb--placeholder">
                  <text class="thumb-emoji">📍</text>
                </view>
                <text class="attraction-chip-name">{{ item.name }}</text>
              </view>
            </scroll-view>
          </view>

          <view class="section section-panel">
            <view class="section-head section-head--with-action">
              <text class="section-title">{{ t('scenes.routesTitle') }}</text>
              <text class="section-action" @click="goCustomPlan">{{ t('scenes.planCustomRoute') }}</text>
            </view>
            <DouxingEmptyState
              v-if="routes.length === 0"
              embedded
              compact
              :title="t('scenes.routesEmpty')"
              :description="t('scenes.routesEmptyDesc')"
              :action-label="t('scenes.planCustomRoute')"
              @action="goCustomPlan"
            />
            <view v-else class="route-list">
              <view
                v-for="item in routes"
                :key="item.id"
                class="route-card"
                @click="goRoute(item.id)"
              >
                <view class="route-card-top">
                  <text class="route-name">{{ item.name }}</text>
                  <text v-if="item.isAiGenerated" class="route-ai-tag">AI</text>
                </view>
                <text class="route-meta">{{ routeMeta(item) }}</text>
                <text class="route-desc">{{ item.description || t('routes.noDescription') }}</text>
                <view class="route-stats">
                  <text class="route-stat">👁 {{ item.viewCount ?? 0 }}</text>
                  <text class="route-stat">♥ {{ item.likeCount ?? 0 }}</text>
                </view>
              </view>
            </view>
          </view>
        </template>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import type { AttractionInfo, TravelRouteInfo, SceneTagSlug } from '@douxing/shared';
import { formatSceneTagLabel, isSceneTagSlug } from '@douxing/shared';
import { fetchSceneDetail } from '@/api/scenes';
import { getAppErrorMessage } from '@/utils/request';
import { getStoredUser } from '@/utils/auth-storage';
import { ensureLoggedInUser } from '@/utils/ensure-logged-in';
import { launchSceneCustomPlan } from '@/utils/plan-launch-intent';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';
import { useInterestTagLabel } from '@/i18n/useInterestTagLabel';

const { themeClass } = useTheme();
const { t, tf } = useTf();
const { currentLocale } = useInterestTagLabel();
usePageTitle('scenes.pageTitle');

const slug = ref<SceneTagSlug>('kids');
const attractions = ref<AttractionInfo[]>([]);
const routes = ref<TravelRouteInfo[]>([]);
const loading = ref(false);
const error = ref('');

const sceneLabel = computed(() => formatSceneTagLabel(slug.value, currentLocale.value));

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

const sceneEmoji = computed(() => SCENE_EMOJI[slug.value] ?? '✨');

onLoad((query) => {
  const raw = String(query?.slug ?? 'kids');
  slug.value = isSceneTagSlug(raw) ? raw : 'kids';
  void loadDetail();
});

onShow(() => {
  if (attractions.value.length === 0 && routes.value.length === 0) {
    void loadDetail();
  }
});

/**
 * 拉取场景专题下的景点与公开路线。
 *
 * @returns void
 */
async function loadDetail() {
  loading.value = true;
  error.value = '';
  try {
    const data = await fetchSceneDetail(slug.value, { attractionLimit: 10, pageSize: 12 });
    attractions.value = data.attractions ?? [];
    routes.value = data.routes?.items ?? [];
  } catch (e) {
    attractions.value = [];
    routes.value = [];
    error.value = getAppErrorMessage(e, t('scenes.loadFailed'));
  } finally {
    loading.value = false;
  }
}

/**
 * 格式化路线卡片副标题（天数 · 预算）。
 *
 * @param item - 路线摘要
 * @returns 展示文案
 */
function routeMeta(item: TravelRouteInfo) {
  return tf('routes.cardMeta', {
    days: item.days,
    budget: item.budgetRange || t('routes.budgetTbd'),
  });
}

/**
 * 进入景点详情页。
 *
 * @param id - 景点 ID
 * @returns void
 */
function goAttraction(id: number) {
  uni.navigateTo({ url: `/pages/attractions/detail?id=${id}` });
}

/**
 * 进入路线详情页。
 *
 * @param id - 路线 ID
 * @returns void
 */
function goRoute(id: number) {
  uni.navigateTo({ url: `/pages/routes/detail?id=${id}` });
}

/**
 * 按当前场景发起定制规划：画像 + 场景 prompt，跳转规划页并自动发送。
 * 有/无精选路线均可使用；后续追问仍受会员等级约束。
 *
 * @returns void
 */
function goCustomPlan() {
  if (!ensureLoggedInUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  const user = getStoredUser();
  launchSceneCustomPlan(
    slug.value,
    {
      interestTags: user?.interestTags,
      preferredScenes: user?.preferredScenes,
      ageRange: user?.ageRange,
      travelRadius: user?.travelRadius,
      companionStructure: user?.companionStructure,
      budgetTier: user?.budgetTier,
    },
    currentLocale.value,
  );
}
</script>

<style scoped>
.page {
  --page-gutter: 32rpx;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--dx-bg);
  box-sizing: border-box;
}

.page-hero {
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
  padding: 48rpx 8rpx 56rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10rpx;
}

.hero-emoji {
  font-size: 52rpx;
  line-height: 1;
}

.hero-title {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--dx-text-inverse);
}

.page-content {
  flex: 1;
  width: 100%;
}

.page-body {
  padding: 0 var(--page-gutter) 32rpx;
  box-sizing: border-box;
}

.section {
  margin-top: 24rpx;
}

.section-panel {
  padding: 28rpx 24rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-lg);
  box-shadow: var(--dx-shadow-sm);
  border: 1rpx solid var(--dx-border);
}

.section-panel + .section-panel {
  margin-top: 28rpx;
}

.section-head {
  margin-bottom: 20rpx;
}
.section-head--with-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.section-action {
  flex-shrink: 0;
  font-size: 26rpx;
  color: var(--dx-primary);
  font-weight: 500;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--dx-text);
}

.section-badge {
  flex-shrink: 0;
  font-size: 20rpx;
  font-weight: 600;
  color: var(--dx-primary);
  background: var(--dx-primary-light);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  letter-spacing: 0.5rpx;
}

.attraction-strip {
  width: 100%;
  white-space: nowrap;
}

.attraction-chip {
  display: inline-flex;
  flex-direction: column;
  width: 168rpx;
  margin-right: 16rpx;
  vertical-align: top;
}

.attraction-chip--hover {
  opacity: 0.85;
}

.attraction-thumb {
  width: 168rpx;
  height: 120rpx;
  border-radius: 16rpx;
  background: var(--dx-bg-muted, #f5f5f5);
  overflow: hidden;
}

.attraction-thumb--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, var(--dx-primary-light), var(--dx-bg));
}

.thumb-emoji {
  font-size: 36rpx;
}

.attraction-chip-name {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  font-weight: 500;
  color: var(--dx-text);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.route-card {
  padding: 24rpx;
  background: var(--dx-bg);
  border-radius: var(--dx-radius-md, 16rpx);
  border: 1rpx solid var(--dx-border);
}

.route-card-top {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.route-name {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--dx-text);
  line-height: 1.35;
}

.route-ai-tag {
  flex-shrink: 0;
  font-size: 20rpx;
  color: var(--dx-text-inverse);
  background: var(--dx-primary);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.route-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--dx-primary);
}

.route-desc {
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

.route-stats {
  display: flex;
  gap: 20rpx;
  margin-top: 16rpx;
}

.route-stat {
  font-size: 22rpx;
  color: var(--dx-text-muted);
}
</style>
