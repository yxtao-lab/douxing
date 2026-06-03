<template>
  <view class="page" :class="themeClass">
    <view class="page-hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <view class="header-brand">
          <view class="logo-mark">
            <text class="hero-emoji">🏅</text>
          </view>
          <view class="header-copy">
            <text class="title">{{ t('nav.achievements') }}</text>
            <text class="hero-desc">{{ t('emptyState.achievementsDesc') }}</text>
          </view>
        </view>
        <view class="summary-stats">
          <text class="summary-count">{{ unlockedCount }}/{{ achievementCatalog.length }}</text>
          <text class="summary-label">{{ t('achievements.unlockedSummary') }}</text>
          <button
            v-if="unlockedCount > 0"
            class="poster-btn"
            @click="posterVisible = true"
          >
            {{ t('achievements.posterAction') }}
          </button>
        </view>
      </view>
    </view>

    <GamificationPosterSheet
      :visible="posterVisible"
      kind="achievements"
      :achievements="achievementCatalog"
      @close="posterVisible = false"
    />

    <view class="page-body">
      <view class="filter-panel">
        <scroll-view scroll-x class="filters" :show-scrollbar="false">
          <view
            v-for="opt in categoryOptions"
            :key="opt.key"
            class="filter-chip"
            :class="{ active: activeCategory === opt.key }"
            @click="activeCategory = opt.key"
          >
            {{ opt.label }}
          </view>
        </scroll-view>

        <scroll-view scroll-x class="filters status-filters" :show-scrollbar="false">
          <view
            v-for="opt in unlockOptions"
            :key="opt.key"
            class="filter-chip"
            :class="{ active: activeUnlockStatus === opt.key }"
            @click="activeUnlockStatus = opt.key"
          >
            {{ opt.label }}
          </view>
        </scroll-view>
      </view>

      <DouxingEmptyState v-if="loading" loading />
      <DouxingEmptyState
        v-else-if="filteredAchievements.length === 0"
        variant="achievements"
        :title="t('achievements.emptyFilter')"
        :description="t('emptyState.achievementsDesc')"
        :secondary-action-label="t('emptyState.filterReset')"
        @secondary-action="resetFilters"
      />
      <view v-else class="achievement-list">
        <view
          v-for="item in filteredAchievements"
          :key="item.id"
          class="achievement-item"
          :class="{ locked: !isCompleted(item), unlocked: isCompleted(item) }"
        >
          <text class="achievement-icon">{{ item.iconUrl || '🏅' }}</text>
          <view class="achievement-body">
            <view class="achievement-head">
              <text class="achievement-name">{{ item.name }}</text>
              <text v-if="isCompleted(item)" class="achievement-tag">{{ t('common.statusUnlocked') }}</text>
            </view>
            <text class="achievement-desc">{{ item.description }}</text>
            <view v-if="!isCompleted(item) && item.progress" class="progress-wrap">
              <view class="progress-bar">
                <view class="progress-fill" :style="{ width: progressPercent(item) + '%' }" />
              </view>
              <text class="achievement-progress">{{ progressLabel(item) }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { AchievementCatalogItem } from '@douxing/shared';
import { AchievementCategory } from '@douxing/shared';
import { fetchAchievementCatalog } from '@/api/achievements';
import { getStoredUser } from '@/utils/request';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';
import GamificationPosterSheet from '@/components/gamification-poster/GamificationPosterSheet.vue';

usePageTitle('nav.achievements');
const { t, tf } = useTf();
const { themeClass } = useTheme();

const categoryOptions = computed(() => [
  { key: 'all', label: t('common.filterAll') },
  { key: AchievementCategory.EXPLORE, label: t('achievementCategory.explore') },
  { key: AchievementCategory.CHALLENGE, label: t('achievementCategory.challenge') },
]);

const unlockOptions = computed(() => [
  { key: 'all', label: t('common.statusAll') },
  { key: 'unlocked', label: t('common.statusUnlocked') },
  { key: 'locked', label: t('common.statusLocked') },
]);

const achievementCatalog = ref<AchievementCatalogItem[]>([]);
const activeCategory = ref('all');
const activeUnlockStatus = ref('all');
const loading = ref(false);
const posterVisible = ref(false);

const unlockedCount = computed(() =>
  achievementCatalog.value.filter((item) => isCompleted(item)).length,
);

const filteredAchievements = computed(() => {
  let list = achievementCatalog.value;

  if (activeCategory.value !== 'all') {
    list = list.filter((item) => item.category === activeCategory.value);
  }

  if (activeUnlockStatus.value === 'unlocked') {
    list = list.filter((item) => isCompleted(item));
  } else if (activeUnlockStatus.value === 'locked') {
    list = list.filter((item) => !isCompleted(item));
  }

  return [...list].sort((a, b) => Number(isCompleted(b)) - Number(isCompleted(a)));
});

function isCompleted(item: AchievementCatalogItem) {
  if (item.unlocked) return true;
  const progress = item.progress;
  if (!progress) return false;
  return progress.current >= progress.target;
}

function progressPercent(item: AchievementCatalogItem) {
  const progress = item.progress;
  if (!progress || progress.target <= 0) return 0;
  return Math.min(100, Math.round((progress.current / progress.target) * 100));
}

function progressLabel(item: AchievementCatalogItem) {
  const progress = item.progress!;
  return tf('achievements.progressLabel', {
    current: progress.current,
    target: progress.target,
  });
}

function resetFilters() {
  activeCategory.value = 'all';
  activeUnlockStatus.value = 'all';
}

onShow(async () => {
  if (!getStoredUser()) {
    uni.showToast({ title: t('common.loginRequired'), icon: 'none' });
    setTimeout(() => uni.navigateBack(), 800);
    return;
  }

  loading.value = true;
  try {
    achievementCatalog.value = await fetchAchievementCatalog();
  } catch {
    achievementCatalog.value = [];
  } finally {
    loading.value = false;
  }
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
.summary-count {
  font-size: 56rpx;
  font-weight: 700;
  display: block;
  line-height: 1.2;
  color: var(--dx-text-inverse);
}
.summary-label {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.9);
  display: block;
  margin-top: 6rpx;
}
.poster-btn {
  margin-top: 20rpx;
  padding: 0 28rpx;
  height: 64rpx;
  line-height: 64rpx;
  font-size: 26rpx;
  border-radius: 999rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.16);
  color: var(--dx-text-inverse);
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
.achievement-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.achievement-item {
  display: flex;
  gap: 20rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 28rpx 24rpx;
  border: 1rpx solid var(--dx-border);
  box-shadow: var(--dx-shadow-sm);
}
.achievement-item.locked .achievement-icon {
  opacity: 0.55;
}
.achievement-item.locked .achievement-name {
  color: var(--dx-text-secondary);
}
.achievement-item.unlocked {
  border-color: var(--dx-primary-border);
  background: var(--dx-primary-light);
}
.achievement-icon {
  font-size: 52rpx;
  flex-shrink: 0;
  line-height: 1;
}
.achievement-body {
  flex: 1;
  min-width: 0;
}
.achievement-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}
.achievement-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.achievement-tag {
  flex-shrink: 0;
  font-size: 20rpx;
  color: var(--dx-primary);
  background: var(--dx-surface);
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
}
.achievement-desc {
  font-size: 24rpx;
  color: var(--dx-text-secondary);
  display: block;
  margin-top: 8rpx;
  line-height: 1.4;
}
.progress-wrap {
  margin-top: 12rpx;
}
.progress-bar {
  height: 8rpx;
  background: var(--dx-border);
  border-radius: 999rpx;
  overflow: hidden;
  margin-bottom: 8rpx;
}
.progress-fill {
  height: 100%;
  background: var(--dx-primary);
  border-radius: 999rpx;
}
.achievement-progress {
  font-size: 22rpx;
  color: var(--dx-text-muted);
}
</style>
