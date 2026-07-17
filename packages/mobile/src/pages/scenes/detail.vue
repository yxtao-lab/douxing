<template>
  <view class="page" :class="themeClass">
    <view class="page-hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <text class="hero-emoji">{{ sceneEmoji }}</text>
        <text class="hero-title">{{ sceneLabel }}</text>
        <text class="hero-sub">{{ t('scenes.pageTitle') }}</text>
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
          <view class="section">
            <view class="section-head">
              <text class="section-title">{{ t('scenes.attractionsTitle') }}</text>
            </view>
            <DouxingEmptyState
              v-if="attractions.length === 0"
              embedded
              compact
              :title="t('scenes.attractionsEmpty')"
            />
            <view v-else class="attraction-grid">
              <view
                v-for="item in attractions"
                :key="item.id"
                class="attraction-card"
              >
                <image
                  v-if="item.coverImageUrl"
                  class="attraction-cover"
                  :src="item.coverImageUrl"
                  mode="aspectFill"
                />
                <view v-else class="attraction-cover attraction-cover--placeholder">
                  <text class="placeholder-emoji">📍</text>
                </view>
                <view class="attraction-info">
                  <text class="attraction-name">{{ item.name }}</text>
                  <text class="attraction-city">{{ item.city }}</text>
                  <view v-if="(item.sceneTags ?? []).length > 0" class="attraction-tags">
                    <text
                      v-for="slug in item.sceneTags"
                      :key="slug"
                      class="attraction-tag"
                    >
                      {{ formatSceneTagLabel(slug, currentLocale) }}
                    </text>
                  </view>
                </view>
              </view>
            </view>
          </view>

          <view class="section">
            <view class="section-head">
              <text class="section-title">{{ t('scenes.routesTitle') }}</text>
            </view>
            <DouxingEmptyState
              v-if="routes.length === 0"
              embedded
              compact
              :title="t('scenes.routesEmpty')"
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
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';

const { themeClass } = useTheme();
const { t, tf, locale } = useTf();
usePageTitle('scenes.pageTitle');

const slug = ref<SceneTagSlug>('kids');
const attractions = ref<AttractionInfo[]>([]);
const routes = ref<TravelRouteInfo[]>([]);
const loading = ref(false);
const error = ref('');

const currentLocale = computed(() => (locale.value ?? 'zh-CN') as 'zh-CN' | 'en-US');

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

async function loadDetail() {
  loading.value = true;
  error.value = '';
  try {
    const data = await fetchSceneDetail(slug.value, { attractionLimit: 12, pageSize: 12 });
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

function routeMeta(item: TravelRouteInfo) {
  return tf('routes.cardMeta', {
    days: item.days,
    budget: item.budgetRange || t('routes.budgetTbd'),
  });
}

function goRoute(id: number) {
  uni.navigateTo({ url: `/pages/routes/detail?id=${id}` });
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
  padding: 32rpx 8rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8rpx;
}

.hero-emoji {
  font-size: 56rpx;
  line-height: 1;
}

.hero-title {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--dx-text-inverse);
}

.hero-sub {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
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
  padding-top: 32rpx;
}

.section-head {
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--dx-text);
}

.attraction-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.attraction-card {
  width: calc(50% - 10rpx);
  background: var(--dx-surface);
  border-radius: var(--dx-radius-lg);
  overflow: hidden;
  box-shadow: var(--dx-shadow-sm);
}

.attraction-cover {
  width: 100%;
  height: 200rpx;
  background: var(--dx-bg-muted, #f5f5f5);
}

.attraction-cover--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-emoji {
  font-size: 56rpx;
}

.attraction-info {
  padding: 20rpx;
}

.attraction-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
  line-height: 1.35;
}

.attraction-city {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--dx-text-muted);
}

.attraction-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}

.attraction-tag {
  font-size: 20rpx;
  color: var(--dx-primary);
  background: var(--dx-primary-light);
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
}

.route-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.route-card {
  padding: 24rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-lg);
  box-shadow: var(--dx-shadow-sm);
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
