<template>
  <view class="page">
    <view class="summary">
      <text class="summary-title">{{ periodLabel }} · {{ metricLabel }}</text>
      <text v-if="myRank != null" class="summary-rank">我的排名：第 {{ myRank }} 名</text>
      <text v-else class="summary-rank">我的排名：暂无数据</text>
      <text class="summary-value">{{ metricLabel }} {{ myValue ?? 0 }}</text>
    </view>

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

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="entries.length === 0" class="empty">该时段暂无排行数据</view>
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
          <text class="sub-stat">打卡 {{ item.checkinCount }} · 积分 {{ item.totalPoints }}</text>
        </view>
        <text class="rank-value">{{ item.value }}{{ metricUnit }}</text>
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

const periodOptions = [
  { key: LeaderboardPeriod.WEEK, label: '周榜' },
  { key: LeaderboardPeriod.MONTH, label: '月榜' },
];

const metricOptions = [
  { key: LeaderboardMetric.CHECKINS, label: '打卡数' },
  { key: LeaderboardMetric.POINTS, label: '积分' },
];

const activePeriod = ref<string>(LeaderboardPeriod.WEEK);
const activeMetric = ref<string>(LeaderboardMetric.CHECKINS);
const loading = ref(false);
const entries = ref<LeaderboardEntry[]>([]);
const myRank = ref<number | null>(null);
const myValue = ref<number | null>(null);

const periodLabel = computed(() =>
  activePeriod.value === LeaderboardPeriod.MONTH ? '本月' : '本周',
);

const metricLabel = computed(() =>
  activeMetric.value === LeaderboardMetric.POINTS ? '积分' : '打卡数',
);

const metricUnit = computed(() =>
  activeMetric.value === LeaderboardMetric.POINTS ? ' 分' : ' 次',
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
      title: err instanceof Error ? err.message : '加载失败',
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
    uni.showToast({ title: '请先登录', icon: 'none' });
    setTimeout(() => uni.navigateBack(), 800);
    return;
  }
  await loadLeaderboard();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 24rpx;
  box-sizing: border-box;
}
.summary {
  background: linear-gradient(135deg, #1677ff, #4096ff);
  border-radius: 16rpx;
  padding: 36rpx 32rpx;
  color: #fff;
  margin-bottom: 24rpx;
}
.summary-title {
  font-size: 28rpx;
  opacity: 0.95;
  display: block;
}
.summary-rank {
  font-size: 34rpx;
  font-weight: 600;
  display: block;
  margin-top: 16rpx;
}
.summary-value {
  font-size: 24rpx;
  opacity: 0.9;
  display: block;
  margin-top: 8rpx;
}
.filters {
  white-space: nowrap;
  margin-bottom: 16rpx;
}
.status-filters {
  margin-bottom: 24rpx;
}
.filter-chip {
  display: inline-block;
  padding: 12rpx 28rpx;
  margin-right: 16rpx;
  background: #fff;
  border-radius: 999rpx;
  font-size: 26rpx;
  color: #6b7280;
}
.filter-chip.active {
  background: #1677ff;
  color: #fff;
}
.empty {
  color: #9ca3af;
  font-size: 28rpx;
  text-align: center;
  padding: 80rpx 0;
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
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  border: 1rpx solid #eef0f3;
}
.rank-item.me {
  border-color: #91caff;
  background: #fafcff;
}
.rank-item.top .rank-no {
  font-size: 36rpx;
}
.rank-no {
  width: 56rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 600;
  color: #6b7280;
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
  background: #1677ff;
  color: #fff;
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
}
.sub-stat {
  font-size: 22rpx;
  color: #9ca3af;
  display: block;
  margin-top: 6rpx;
}
.rank-value {
  font-size: 32rpx;
  font-weight: 700;
  color: #1677ff;
  flex-shrink: 0;
}
</style>
