<template>
  <view class="page" :class="themeClass">
    <view class="page-hero">
      <view class="hero-bg" />
      <view class="hero-content">
        <view class="header-brand">
          <view class="logo-mark">
            <text class="hero-emoji">📷</text>
          </view>
          <view class="header-copy">
            <text class="title">{{ t('nav.myAlbum') }}</text>
            <text class="hero-desc">{{ t('myAlbum.desc') }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="page-body">
      <view v-if="storageSummary" class="storage-bar">
        <text class="storage-text">{{ storageSummary }}</text>
        <view class="storage-track">
          <view class="storage-fill" :style="{ width: storagePercent + '%' }" />
        </view>
      </view>

      <MyAlbumUploadBar @uploaded="refresh" />

      <DouxingEmptyState
        v-if="!loading && items.length === 0"
        variant="checkins"
        :title="t('myAlbum.empty')"
        :description="t('myAlbum.emptyHint')"
        :action-label="t('profile.actionRoutes')"
        @action="goRoutes"
      />

      <view v-else class="photo-grid">
        <view v-for="item in items" :key="item.id" class="photo-card">
          <image
            class="photo-thumb"
            :src="item.storedUrl"
            mode="aspectFill"
            @click="previewPhoto(item)"
          />
          <view class="photo-meta">
            <text class="route-name" @click.stop="goRouteDetail(item.routeId)">
              {{ item.routeName || item.albumTitle }}
            </text>
            <text class="poi-meta">{{ photoMeta(item) }}</text>
          </view>
        </view>
      </view>

      <view v-if="loadingMore" class="list-footer">{{ t('common.loadMore') }}</view>
      <view v-else-if="!hasMore && items.length > 0" class="list-footer muted">{{ t('common.noMore') }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { onReachBottom, onShow } from '@dcloudio/uni-app';
import type { UserTravelPhotoListItem } from '@douxing/shared';
import { fetchPhotoStorage, fetchTravelPhotosPage, formatStorageBytes } from '@/api/journey-albums';
import { useInfiniteList } from '@/composables/useInfiniteList';
import { getStoredUser } from '@/utils/request';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';
import MyAlbumUploadBar from '@/components/my-album/MyAlbumUploadBar.vue';

usePageTitle('nav.myAlbum');
const { t, tf } = useTf();
const { themeClass } = useTheme();

const storageUsedBytes = ref(0);
const storageMaxBytes = ref(1);
const storageUsedCount = ref(0);
const storageMaxCount = ref(1);

const { items, loading, loadingMore, hasMore, loadInitial, loadMore } = useInfiniteList(
  (page, pageSize) => fetchTravelPhotosPage({ page, pageSize }),
);

const storageSummary = computed(() => {
  if (storageMaxBytes.value <= 1 && storageUsedBytes.value === 0) return '';
  return tf('journeyAlbum.storageSummary', {
    usedBytes: formatStorageBytes(storageUsedBytes.value),
    maxBytes: formatStorageBytes(storageMaxBytes.value),
    usedCount: storageUsedCount.value,
    maxCount: storageMaxCount.value,
  });
});

const storagePercent = computed(() => {
  const byteRatio = storageMaxBytes.value > 0 ? storageUsedBytes.value / storageMaxBytes.value : 0;
  const countRatio = storageMaxCount.value > 0 ? storageUsedCount.value / storageMaxCount.value : 0;
  return Math.min(100, Math.round(Math.max(byteRatio, countRatio) * 100));
});

function photoMeta(item: UserTravelPhotoListItem): string {
  if (item.dayIndex != null && item.poiName) {
    return tf('myAlbum.poiMeta', { day: item.dayIndex + 1, poi: item.poiName });
  }
  if (item.dayIndex != null) {
    return tf('myAlbum.dayOnlyMeta', { day: item.dayIndex + 1 });
  }
  if (item.poiName) return item.poiName;
  return t('journeyAlbum.unassigned');
}

function previewPhoto(item: UserTravelPhotoListItem) {
  const urls = items.value.map((photo) => photo.storedUrl);
  const index = items.value.findIndex((photo) => photo.id === item.id);
  uni.previewImage({
    urls,
    current: index >= 0 ? index : 0,
  });
}

function goRouteDetail(routeId: number) {
  uni.navigateTo({ url: `/pages/routes/detail?id=${routeId}` });
}

function goRoutes() {
  uni.switchTab({ url: '/pages/routes/list' });
}

async function loadStorage() {
  try {
    const storage = await fetchPhotoStorage();
    storageUsedBytes.value = storage.usedBytes;
    storageMaxBytes.value = storage.maxBytes;
    storageUsedCount.value = storage.usedCount;
    storageMaxCount.value = storage.maxCount;
  } catch {
    /* ignore */
  }
}

async function refresh() {
  await Promise.all([loadInitial(), loadStorage()]);
}

onShow(() => {
  if (!getStoredUser()) {
    uni.showToast({ title: t('common.loginRequired'), icon: 'none' });
    setTimeout(() => uni.navigateBack(), 800);
    return;
  }
  void refresh();
});

onReachBottom(() => {
  if (hasMore.value && !loadingMore.value) {
    void loadMore();
  }
});

onMounted(() => {
  if (getStoredUser()) {
    void refresh();
  }
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--dx-bg);
  padding-bottom: 48rpx;
}
.page-hero {
  position: relative;
  padding: 24rpx 32rpx 28rpx;
  margin-bottom: 8rpx;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--dx-gradient-hero);
  border-radius: 0 0 var(--dx-radius-xl) var(--dx-radius-xl);
}
.hero-content {
  position: relative;
  z-index: 1;
}
.header-brand {
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.logo-mark {
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.hero-emoji {
  font-size: 44rpx;
}
.title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
}
.hero-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}
.page-body {
  padding: 0 32rpx;
}
.storage-bar {
  margin-bottom: 24rpx;
  padding: 20rpx 24rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  box-shadow: var(--dx-shadow-sm);
}
.storage-text {
  display: block;
  font-size: 24rpx;
  color: var(--dx-text);
  margin-bottom: 12rpx;
}
.storage-track {
  height: 12rpx;
  border-radius: 999rpx;
  background: var(--dx-border);
  overflow: hidden;
}
.storage-fill {
  height: 100%;
  border-radius: 999rpx;
  background: var(--dx-primary);
}
.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.photo-card {
  width: calc((100% - 16rpx) / 2);
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  overflow: hidden;
  box-shadow: var(--dx-shadow-sm);
}
.photo-thumb {
  width: 100%;
  aspect-ratio: 1;
  display: block;
  background: var(--dx-border);
}
.photo-meta {
  padding: 16rpx;
}
.route-name {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--dx-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.poi-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--dx-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.list-footer {
  padding: 32rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: var(--dx-text-secondary);
}
.list-footer.muted {
  color: var(--dx-text-secondary);
  opacity: 0.7;
}
</style>
