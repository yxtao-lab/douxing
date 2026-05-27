<template>
  <view class="page">
    <view class="summary">
      <text class="summary-count">{{ unlockedCount }}/{{ achievementCatalog.length }}</text>
      <text class="summary-label">{{ t('achievements.unlockedSummary') }}</text>
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

    <view v-if="loading" class="empty">{{ t('common.loading') }}</view>
    <view v-else-if="filteredAchievements.length === 0" class="empty">{{ t('achievements.emptyFilter') }}</view>
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
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { AchievementCatalogItem } from '@douxing/shared';
import { AchievementCategory } from '@douxing/shared';
import { fetchAchievementCatalog } from '@/api/achievements';
import { getStoredUser } from '@/utils/request';
import { useTf } from '@/i18n/useTf';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('nav.achievements');
const { t, tf } = useTf();

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
.empty {
  color: #9ca3af;
  font-size: 28rpx;
  text-align: center;
  padding: 80rpx 0;
}
.achievement-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.achievement-item {
  display: flex;
  gap: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx 24rpx;
  border: 1rpx solid #eef0f3;
}
.achievement-item.locked .achievement-icon {
  opacity: 0.55;
}
.achievement-item.locked .achievement-name {
  color: #6b7280;
}
.achievement-item.unlocked {
  border-color: #d4e8ff;
  background: #fafcff;
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
}
.achievement-tag {
  flex-shrink: 0;
  font-size: 20rpx;
  color: #1677ff;
  background: #e6f4ff;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
}
.achievement-desc {
  font-size: 24rpx;
  color: #6b7280;
  display: block;
  margin-top: 8rpx;
  line-height: 1.4;
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
}
.achievement-progress {
  font-size: 22rpx;
  color: #9ca3af;
}
</style>
