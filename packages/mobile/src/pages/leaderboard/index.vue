<template>
  <view class="page" :class="themeClass">
    <view class="page-hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <view class="header-brand">
          <view class="logo-mark">
            <text class="hero-emoji">🏆</text>
          </view>
          <view class="header-copy">
            <text class="title">{{ t('nav.leaderboard') }}</text>
            <text class="hero-desc">{{ t('emptyState.leaderboardDesc') }}</text>
          </view>
        </view>
        <view class="summary-stats">
          <text class="summary-title">{{ periodLabel }} · {{ metricLabel }}</text>
          <text v-if="myRank != null" class="summary-rank">{{ myRankText }}</text>
          <text v-else class="summary-rank">{{ t('leaderboard.myRankEmpty') }}</text>
          <text class="summary-value">{{ myValueText }}</text>
        </view>
      </view>
    </view>

    <view class="page-body">
      <view class="filter-panel">
        <scroll-view scroll-x class="filters" :show-scrollbar="false">
          <view
            v-for="opt in periodOptions"
            :key="opt.key"
            class="filter-chip"
            :class="{ active: activePeriod === opt.key }"
            @click="switchPeriod(opt.key)"
          >
            {{ opt.label }}
          </view>
        </scroll-view>

        <scroll-view scroll-x class="filters status-filters" :show-scrollbar="false">
          <view
            v-for="opt in metricOptions"
            :key="opt.key"
            class="filter-chip"
            :class="{ active: activeMetric === opt.key }"
            @click="switchMetric(opt.key)"
          >
            {{ opt.label }}
          </view>
        </scroll-view>
      </view>

      <DouxingEmptyState v-if="loading" loading />
      <DouxingEmptyState
        v-else-if="entries.length === 0"
        variant="leaderboard"
        :title="t('leaderboard.empty')"
        :description="t('emptyState.leaderboardDesc')"
      />
      <view v-else class="rank-list">
        <view
          v-for="item in entries"
          :key="item.userId"
          class="rank-item"
          :class="{ me: item.isMe, top: item.rank <= 3 }"
        >
          <text class="rank-no" :class="'rank-' + item.rank">{{ formatRank(item.rank) }}</text>
          <image v-if="item.avatar" class="avatar-img" :src="item.avatar" mode="aspectFill" />
          <view v-else class="avatar">{{ avatarText(item.nickname) }}</view>
          <view class="rank-body">
            <text class="nickname">{{ item.nickname }}</text>
            <text class="sub-stat">{{ userStatsText(item) }}</text>
          </view>
          <text class="rank-value">{{ item.value }}{{ metricUnit }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { LeaderboardEntry } from '@douxing/shared';
import { LeaderboardMetric, LeaderboardPeriod } from '@douxing/shared';
import { fetchLeaderboard } from '@/api/leaderboard';
import { getStoredUser } from '@/utils/request';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';

usePageTitle('nav.leaderboard');
const { t, tf } = useTf();
const { themeClass } = useTheme();

const periodOptions = computed(() => [
  { key: LeaderboardPeriod.WEEK, label: t('leaderboard.periodWeek') },
  { key: LeaderboardPeriod.MONTH, label: t('leaderboard.periodMonth') },
]);

const metricOptions = computed(() => [
  { key: LeaderboardMetric.CHECKINS, label: t('leaderboard.metricCheckins') },
  { key: LeaderboardMetric.POINTS, label: t('leaderboard.metricPoints') },
]);

const activePeriod = ref<string>(LeaderboardPeriod.WEEK);
const activeMetric = ref<string>(LeaderboardMetric.CHECKINS);
const loading = ref(false);
const entries = ref<LeaderboardEntry[]>([]);
const myRank = ref<number | null>(null);
const myValue = ref<number | null>(null);

const periodLabel = computed(() =>
  activePeriod.value === LeaderboardPeriod.MONTH
    ? t('leaderboard.thisMonth')
    : t('leaderboard.thisWeek'),
);

const metricLabel = computed(() =>
  activeMetric.value === LeaderboardMetric.POINTS
    ? t('leaderboard.metricPoints')
    : t('leaderboard.metricCheckins'),
);

const metricUnit = computed(() =>
  activeMetric.value === LeaderboardMetric.POINTS
    ? t('leaderboard.pointsUnit')
    : t('leaderboard.checkinUnit'),
);

const myRankText = computed(() =>
  myRank.value != null ? tf('leaderboard.myRank', { rank: myRank.value }) : '',
);

const myValueText = computed(() =>
  tf('leaderboard.myValue', {
    metric: metricLabel.value,
    value: myValue.value ?? 0,
  }),
);

function avatarText(name: string) {
  return (name || '?').slice(0, 1);
}

function formatRank(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

function userStatsText(item: LeaderboardEntry) {
  return tf('leaderboard.userStats', {
    checkins: item.checkinCount,
    points: item.totalPoints,
  });
}

async function loadLeaderboard() {
  loading.value = true;
  try {
    const result = await fetchLeaderboard({
      period: activePeriod.value as 'week' | 'month',
      metric: activeMetric.value as 'checkins' | 'points',
    });
    entries.value = result.entries;
    myRank.value = result.myRank;
    myValue.value = result.myValue;
  } catch (err) {
    entries.value = [];
    myRank.value = null;
    myValue.value = null;
    uni.showToast({
      title: err instanceof Error ? err.message : t('common.loadFailed'),
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

function switchPeriod(key: string) {
  if (activePeriod.value === key) return;
  activePeriod.value = key;
  loadLeaderboard();
}

function switchMetric(key: string) {
  if (activeMetric.value === key) return;
  activeMetric.value = key;
  loadLeaderboard();
}

onShow(async () => {
  if (!getStoredUser()) {
    uni.showToast({ title: t('common.loginRequired'), icon: 'none' });
    setTimeout(() => uni.navigateBack(), 800);
    return;
  }
  await loadLeaderboard();
});
</script>

<style scoped>
.page {
  --page-gutter: 32rpx;
  min-height: 100vh;
  background: var(--dx-bg);
  box-sizing: border-box;
}
.page-hero {
  position: relative;
  padding: 24rpx var(--page-gutter) 28rpx;
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
.header-brand {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}
.logo-mark {
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--dx-radius-md);
  background: rgba(255, 255, 255, 0.2);
  border: 2rpx solid rgba(255, 255, 255, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.hero-emoji {
  font-size: 32rpx;
  line-height: 1;
}
.header-copy {
  flex: 1;
  min-width: 0;
}
.title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: var(--dx-text-inverse);
  line-height: 1.35;
}
.hero-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.45;
}
.summary-stats {
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.22);
}
.summary-title {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.92);
  display: block;
}
.summary-rank {
  font-size: 34rpx;
  font-weight: 600;
  display: block;
  margin-top: 16rpx;
  color: var(--dx-text-inverse);
}
.summary-value {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.88);
  display: block;
  margin-top: 8rpx;
}
.page-body {
  padding: 0 var(--page-gutter) 32rpx;
}
.filter-panel {
  margin-bottom: 20rpx;
  padding: 16rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  box-shadow: var(--dx-shadow-sm);
}
.filters {
  white-space: nowrap;
}
.status-filters {
  margin-top: 12rpx;
}
.filter-chip {
  display: inline-block;
  padding: 12rpx 28rpx;
  margin-right: 12rpx;
  background: var(--dx-bg);
  border-radius: 999rpx;
  font-size: 26rpx;
  color: var(--dx-text-secondary);
}
.filter-chip.active {
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
}
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 24rpx;
  border: 1rpx solid var(--dx-border);
  box-shadow: var(--dx-shadow-sm);
}
.rank-item.me {
  border-color: rgba(22, 119, 255, 0.35);
  background: var(--dx-primary-light);
}
.rank-item.top .rank-no {
  font-size: 36rpx;
}
.rank-no {
  width: 56rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text-secondary);
  flex-shrink: 0;
}
.avatar,
.avatar-img {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  flex-shrink: 0;
}
.avatar {
  line-height: 72rpx;
  text-align: center;
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
  font-size: 28rpx;
}
.rank-body {
  flex: 1;
  min-width: 0;
}
.nickname {
  font-size: 30rpx;
  font-weight: 600;
  display: block;
  color: var(--dx-text);
}
.sub-stat {
  font-size: 22rpx;
  color: var(--dx-text-muted);
  display: block;
  margin-top: 6rpx;
}
.rank-value {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--dx-primary);
  flex-shrink: 0;
}
</style>
