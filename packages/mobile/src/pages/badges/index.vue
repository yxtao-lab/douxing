<template>
  <view class="page" :class="themeClass">
    <view class="page-hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <view class="header-brand">
          <view class="logo-mark">
            <text class="hero-emoji">🎖️</text>
          </view>
          <view class="header-copy">
            <text class="title">{{ t('nav.badges') }}</text>
            <text class="hero-desc">{{ t('emptyState.badgesDesc') }}</text>
          </view>
        </view>
        <view class="summary-stats">
          <text class="summary-count">{{ unlockedCount }}/{{ badgeCatalog.length }}</text>
          <text class="summary-label">{{ t('badges.unlockedSummary') }}</text>
        </view>
      </view>
    </view>

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
        v-else-if="filteredBadges.length === 0"
        variant="badges"
        :title="t('badges.emptyFilter')"
        :description="t('emptyState.badgesDesc')"
        :secondary-action-label="t('emptyState.filterReset')"
        @secondary-action="resetFilters"
      />
      <view v-else class="badge-grid">
        <view
          v-for="item in filteredBadges"
          :key="item.id"
          class="badge-item"
          :class="{ locked: !isCompleted(item), unlocked: isCompleted(item) }"
        >
          <text class="badge-icon">{{ item.iconUrl || '🏅' }}</text>
          <text class="badge-name">{{ item.name }}</text>
          <text class="badge-desc">{{ item.description }}</text>
          <view v-if="!isCompleted(item) && item.progress" class="progress-wrap">
            <view class="progress-bar">
              <view
                class="progress-fill"
                :style="{ width: progressPercent(item) + '%' }"
              />
            </view>
            <text class="badge-progress">{{ progressLabel(item) }}</text>
          </view>
          <text v-else-if="isCompleted(item)" class="badge-unlocked">{{ t('common.statusUnlocked') }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { BadgeCatalogItem } from '@douxing/shared';
import { BadgeCategory } from '@douxing/shared';
import { fetchBadgeCatalog } from '@/api/badges';
import { getStoredUser } from '@/utils/request';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';

usePageTitle('nav.badges');
const { t, tf } = useTf();
const { themeClass } = useTheme();

const categoryOptions = computed(() => [
  { key: 'all', label: t('common.filterAll') },
  { key: BadgeCategory.CITY, label: t('badgeCategory.city') },
  { key: BadgeCategory.ACHIEVEMENT, label: t('badgeCategory.achievement') },
  { key: BadgeCategory.SPECIAL, label: t('badgeCategory.special') },
]);

const unlockOptions = computed(() => [
  { key: 'all', label: t('common.statusAll') },
  { key: 'unlocked', label: t('common.statusUnlocked') },
  { key: 'locked', label: t('common.statusLocked') },
]);

const badgeCatalog = ref<BadgeCatalogItem[]>([]);
const activeCategory = ref('all');
const activeUnlockStatus = ref('all');
const loading = ref(false);

const unlockedCount = computed(() => badgeCatalog.value.filter((item) => isCompleted(item)).length);

const filteredBadges = computed(() => {
  let list = badgeCatalog.value;

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

function isCompleted(item: BadgeCatalogItem) {
  if (item.unlocked) return true;
  const progress = item.progress;
  if (!progress) return false;
  return progress.current >= progress.target;
}

function progressPercent(item: BadgeCatalogItem) {
  const progress = item.progress;
  if (!progress || progress.target <= 0) return 0;
  return Math.min(100, Math.round((progress.current / progress.target) * 100));
}

function progressLabel(item: BadgeCatalogItem) {
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
    badgeCatalog.value = await fetchBadgeCatalog();
  } catch {
    badgeCatalog.value = [];
    uni.showToast({ title: t('common.loadFailed'), icon: 'none' });
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
.badge-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.badge-item {
  position: relative;
  width: calc(50% - 8rpx);
  box-sizing: border-box;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 28rpx 20rpx;
  text-align: center;
  border: 1rpx solid var(--dx-border);
  box-shadow: var(--dx-shadow-sm);
}
.badge-item.locked .badge-icon {
  opacity: 0.55;
}
.badge-item.locked .badge-name {
  color: var(--dx-text-secondary);
}
.badge-item.locked .badge-desc {
  color: var(--dx-text-muted);
}
.badge-item.unlocked {
  border-color: rgba(22, 119, 255, 0.25);
  background: var(--dx-primary-light);
}
.badge-icon {
  font-size: 56rpx;
  display: block;
  margin-bottom: 12rpx;
}
.badge-name {
  font-size: 28rpx;
  font-weight: 600;
  display: block;
  line-height: 1.3;
  color: var(--dx-text);
}
.badge-desc {
  font-size: 22rpx;
  color: var(--dx-text-secondary);
  display: block;
  margin-top: 8rpx;
  line-height: 1.4;
}
.badge-progress {
  font-size: 22rpx;
  color: var(--dx-text-muted);
  display: block;
  margin-top: 8rpx;
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
  transition: width 0.3s;
}
.badge-unlocked {
  display: inline-block;
  margin-top: 12rpx;
  padding: 4rpx 16rpx;
  font-size: 20rpx;
  color: var(--dx-primary);
  background: var(--dx-surface);
  border-radius: 999rpx;
  font-weight: 500;
}
</style>
