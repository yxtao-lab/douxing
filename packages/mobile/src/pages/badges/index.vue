<template>
  <view class="page">
    <view class="summary">
      <text class="summary-count">{{ unlockedCount }}/{{ badgeCatalog.length }}</text>
      <text class="summary-label">{{ t('badges.unlockedSummary') }}</text>
    </view>

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
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { BadgeCatalogItem } from '@douxing/shared';
import { BadgeCategory } from '@douxing/shared';
import { fetchBadgeCatalog } from '@/api/badges';
import { getStoredUser } from '@/utils/request';
import { useTf } from '@/i18n/useTf';
import { usePageTitle } from '@/i18n/usePageTitle';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';

usePageTitle('nav.badges');
const { t, tf } = useTf();

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
  min-height: 100vh;
  background: #f5f7fa;
  padding: 24rpx;
  box-sizing: border-box;
}
.summary {
  background: linear-gradient(135deg, #1677ff, #4096ff);
  border-radius: 16rpx;
  padding: 40rpx 32rpx;
  color: #fff;
  margin-bottom: 24rpx;
}
.summary-count {
  font-size: 56rpx;
  font-weight: 700;
  display: block;
  line-height: 1.2;
}
.summary-label {
  font-size: 26rpx;
  opacity: 0.9;
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
.badge-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.badge-item {
  position: relative;
  width: calc(50% - 8rpx);
  box-sizing: border-box;
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx 20rpx;
  text-align: center;
  border: 1rpx solid #eef0f3;
}
.badge-item.locked .badge-icon {
  opacity: 0.55;
}
.badge-item.locked .badge-name {
  color: #6b7280;
}
.badge-item.locked .badge-desc {
  color: #9ca3af;
}
.badge-item.unlocked {
  border-color: #d4e8ff;
  background: #fafcff;
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
}
.badge-desc {
  font-size: 22rpx;
  color: #6b7280;
  display: block;
  margin-top: 8rpx;
  line-height: 1.4;
}
.badge-progress,
.badge-unlocked {
  font-size: 22rpx;
  color: #9ca3af;
  display: block;
  margin-top: 8rpx;
}
.progress-wrap {
  margin-top: 12rpx;
}
.progress-bar {
  height: 8rpx;
  background: #e5e7eb;
  border-radius: 999rpx;
  overflow: hidden;
  margin-bottom: 8rpx;
}
.progress-fill {
  height: 100%;
  background: #bfdbfe;
  border-radius: 999rpx;
  transition: width 0.3s;
}
.badge-unlocked {
  display: inline-block;
  margin-top: 12rpx;
  padding: 4rpx 16rpx;
  font-size: 20rpx;
  color: #1677ff;
  background: #e6f4ff;
  border-radius: 999rpx;
  font-weight: 500;
}
</style>
