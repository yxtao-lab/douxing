<template>
  <view class="page" :class="themeClass">
    <view v-if="loading" class="state">{{ t('shareRoute.loading') }}</view>
    <view v-else-if="error" class="state">{{ error }}</view>
    <view v-else-if="route" class="content">
      <view class="hero">
        <view class="hero-bg" />
        <view class="hero-inner">
          <text class="badge">{{ t('shareRoute.badge') }}</text>
          <text class="title">{{ route.name }}</text>
          <text class="meta">{{ heroMeta }}</text>
          <text v-if="route.description" class="desc">{{ route.description }}</text>
          <text v-if="route.creatorNickname" class="author">{{ authorLine }}</text>
          <button
            v-if="routeVideo"
            class="btn-route-video"
            @click="openRouteVideo"
          >
            ▶ {{ t('routes.playRouteVideo') }}
          </button>
        </view>
      </view>

      <view class="card">
        <text class="section-title">{{ t('shareRoute.highlights') }}</text>
        <view v-for="(day, index) in previewDays" :key="index" class="day-block">
          <text class="day-title">{{ dayTitle(day, index) }}</text>
          <view v-for="(spot, spotIndex) in day.attractions.slice(0, 3)" :key="spotIndex" class="spot">
            <image
              v-if="spot.coverImageUrl"
              class="spot-thumb"
              :src="spot.coverImageUrl"
              mode="aspectFill"
            />
            <view class="spot-text">
              <text class="spot-name">{{ spot.name }}</text>
              <text v-if="spot.time" class="spot-time">{{ spot.time }}</text>
            </view>
          </view>
        </view>
        <text v-if="hiddenDayCount > 0" class="more-days">{{ moreDaysText }}</text>
      </view>

      <view class="cta-card">
        <text class="cta-title">{{ t('shareRoute.ctaTitle') }}</text>
        <text class="cta-desc">{{ t('shareRoute.ctaDesc') }}</text>
        <button class="btn-primary" @click="openApp">{{ t('shareRoute.openApp') }}</button>
      </view>
    </view>
  </view>

  <RouteMediaPlayerSheet
    :visible="mediaPlayerVisible"
    :video-url="mediaPlayerUrl"
    :cover-url="mediaPlayerCover"
    :title="mediaPlayerTitle"
    @close="mediaPlayerVisible = false"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import type { RouteDayPlan, RouteDetailPayload, TravelRouteInfo } from '@douxing/shared';
import { fetchSharedRoute } from '@/api/share';
import RouteMediaPlayerSheet from '@/components/route-media/RouteMediaPlayerSheet.vue';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';
import { useInterestTagLabel } from '@/i18n/useInterestTagLabel';
import { getAppErrorMessage } from '@/utils/request';

const { t, tf } = useTf();
const { themeClass } = useTheme();
const { joinLabels } = useInterestTagLabel();
usePageTitle('shareRoute.pageTitle');

const route = ref<TravelRouteInfo | null>(null);
const loading = ref(true);
const error = ref('');
const mediaPlayerVisible = ref(false);
const mediaPlayerUrl = ref('');
const mediaPlayerCover = ref<string | null>(null);
const mediaPlayerTitle = ref('');
let routeId = 0;

const tags = computed(() => joinLabels.value(route.value?.interestTags));

const heroMeta = computed(() => {
  if (!route.value) return '';
  return tf('routes.metaHero', {
    days: route.value.days,
    budget: route.value.budgetRange ?? t('routes.budgetTbd'),
    tags: tags.value,
  });
});

const authorLine = computed(() => {
  if (!route.value?.creatorNickname) return '';
  return tf('routes.authorShare', { name: route.value.creatorNickname });
});

const previewDays = computed((): RouteDayPlan[] => {
  const detail = route.value?.routeDetail as RouteDetailPayload | null;
  return (detail?.days ?? []).slice(0, 4);
});

const routeVideo = computed(() => {
  const detail = route.value?.routeDetail as RouteDetailPayload | null;
  return detail?.routeVideo ?? null;
});

/**
 * 打开分享页路线视频播放器。
 */
function openRouteVideo() {
  const video = routeVideo.value;
  if (!video?.videoUrl) return;
  mediaPlayerUrl.value = video.videoUrl;
  mediaPlayerCover.value = video.coverUrl ?? null;
  mediaPlayerTitle.value = route.value?.name ?? '';
  mediaPlayerVisible.value = true;
}

const hiddenDayCount = computed(() => {
  const detail = route.value?.routeDetail as RouteDetailPayload | null;
  const total = detail?.days?.length ?? 0;
  return Math.max(0, total - 4);
});

const moreDaysText = computed(() =>
  tf('shareRoute.moreDays', { count: hiddenDayCount.value }),
);

function dayTitle(day: RouteDayPlan, index: number) {
  if (day.title?.trim()) return day.title;
  return tf('routes.flowDayTab', { day: index + 1 });
}

function parseRouteIdFromQuery(query: Record<string, string | undefined> | undefined): number {
  const direct = parseInt(String(query?.id ?? ''), 10);
  if (direct > 0) return direct;

  const scene = query?.scene;
  if (!scene) return 0;

  const decoded = decodeURIComponent(String(scene));
  const idMatch = decoded.match(/(?:^|&?)id=(\d+)/);
  if (idMatch?.[1]) return parseInt(idMatch[1], 10);

  const plain = decoded.match(/^(\d+)$/);
  return plain?.[1] ? parseInt(plain[1], 10) : 0;
}

async function loadRoute() {
  loading.value = true;
  error.value = '';
  try {
    route.value = await fetchSharedRoute(routeId);
  } catch (err) {
    error.value = getAppErrorMessage(err, t('shareRoute.loadFailed'));
    route.value = null;
  } finally {
    loading.value = false;
  }
}

function openApp() {
  uni.navigateTo({
    url: `/pages/routes/detail?id=${routeId}`,
    fail: () => {
      uni.showToast({ title: t('shareRoute.openAppFailed'), icon: 'none' });
    },
  });
}

onLoad((query) => {
  routeId = parseRouteIdFromQuery(query as Record<string, string | undefined>);
  if (routeId) {
    void loadRoute();
  } else {
    loading.value = false;
    error.value = t('shareRoute.invalidLink');
  }
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--dx-bg);
  padding-bottom: 48rpx;
}
.state {
  padding: 120rpx 48rpx;
  text-align: center;
  color: var(--dx-text-muted);
  font-size: 28rpx;
}
.hero {
  position: relative;
  padding: 48rpx 32rpx 40rpx;
  color: var(--dx-text-inverse);
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--dx-gradient-hero);
}
.hero-inner {
  position: relative;
  z-index: 1;
}
.badge {
  display: inline-block;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.22);
  font-size: 20rpx;
  margin-bottom: 16rpx;
}
.title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.35;
}
.meta {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  opacity: 0.92;
}
.desc {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.5;
  opacity: 0.95;
}
.author {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  opacity: 0.9;
}
.btn-route-video {
  margin-top: 20rpx;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 26rpx;
  border-radius: 999rpx;
}
.card,
.cta-card {
  margin: 24rpx 32rpx 0;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 28rpx;
  box-shadow: var(--dx-shadow-sm);
}
.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--dx-text);
  margin-bottom: 16rpx;
}
.day-block {
  margin-bottom: 24rpx;
}
.day-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--dx-primary);
  margin-bottom: 12rpx;
}
.spot {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
  align-items: flex-start;
  padding-left: 16rpx;
  border-left: 4rpx solid var(--dx-primary-light);
  margin-bottom: 16rpx;
}
.spot-thumb {
  width: 88rpx;
  height: 88rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
  background: var(--dx-bg);
}
.spot-text {
  flex: 1;
  min-width: 0;
}
.spot-name {
  display: block;
  font-size: 26rpx;
  color: var(--dx-text);
}
.spot-time {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--dx-text-muted);
}
.more-days {
  display: block;
  font-size: 22rpx;
  color: var(--dx-text-muted);
}
.cta-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.cta-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--dx-text-muted);
  line-height: 1.5;
}
.btn-primary {
  margin-top: 24rpx;
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
  border-radius: var(--dx-radius-lg);
  border: none;
}
</style>
