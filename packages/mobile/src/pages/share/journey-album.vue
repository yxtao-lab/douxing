<template>
  <view class="page" :class="themeClass">
    <view v-if="loading" class="state">{{ t('shareJourneyAlbum.loading') }}</view>
    <view v-else-if="error" class="state">{{ error }}</view>
    <view v-else-if="payload" class="content">
      <view class="hero">
        <image
          v-if="payload.coverPhotoUrl"
          class="hero-cover"
          :src="payload.coverPhotoUrl"
          mode="aspectFill"
        />
        <view class="hero-bg" />
        <view class="hero-inner">
          <text class="badge">{{ t('shareJourneyAlbum.badge') }}</text>
          <text class="title">{{ payload.title }}</text>
          <text v-if="payload.routeName" class="meta">{{ payload.routeName }}</text>
          <text class="meta">{{ photoCountText }}</text>
        </view>
      </view>

      <view v-for="group in displayGroups" :key="groupKey(group)" class="card">
        <text class="section-title">{{ groupTitle(group) }}</text>
        <view class="photo-grid">
          <image
            v-for="photo in group.photos"
            :key="photo.id"
            class="photo-thumb"
            :src="photo.storedUrl"
            mode="aspectFill"
          />
        </view>
      </view>

      <view v-if="payload.photoCount === 0" class="card state-inner">
        <text>{{ t('shareJourneyAlbum.empty') }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import type { JourneyAlbumPhotoGroup, SharedJourneyAlbumPayload } from '@douxing/shared';
import { fetchSharedJourneyAlbum } from '@/api/journey-albums';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';
import { getAppErrorMessage } from '@/utils/request';

const { t, tf } = useTf();
const { themeClass } = useTheme();
usePageTitle('shareJourneyAlbum.pageTitle');

const payload = ref<SharedJourneyAlbumPayload | null>(null);
const loading = ref(true);
const error = ref('');
let shareToken = '';

const photoCountText = computed(() =>
  tf('shareJourneyAlbum.photoCount', { count: payload.value?.photoCount ?? 0 }),
);

const displayGroups = computed(() => {
  if (!payload.value) return [];
  return payload.value.groups.filter(
    (group) => group.photos.length > 0 && (group.dayIndex != null || Boolean(group.poiName?.trim())),
  );
});

function groupKey(group: JourneyAlbumPhotoGroup) {
  return `${group.dayIndex ?? 'null'}::${group.poiName ?? 'null'}::${group.attractionId ?? 'null'}`;
}

function groupTitle(group: JourneyAlbumPhotoGroup) {
  if (group.dayIndex != null && group.poiName) {
    return tf('journeyAlbum.groupDayPoi', { day: group.dayIndex + 1, poi: group.poiName });
  }
  if (group.dayIndex != null) {
    return tf('journeyAlbum.groupDayOnly', { day: group.dayIndex + 1 });
  }
  return group.poiName ?? t('journeyAlbum.unassigned');
}

function parseTokenFromQuery(
  query: Record<string, string | undefined> | undefined,
): string {
  const direct = String(query?.token ?? '').trim();
  if (direct) return direct;

  const scene = query?.scene;
  if (!scene) return '';

  const decoded = decodeURIComponent(String(scene));
  const tokenMatch = decoded.match(/(?:^|&?)token=([^&]+)/);
  if (tokenMatch?.[1]) return tokenMatch[1].trim();

  return decoded.trim();
}

async function loadAlbum() {
  loading.value = true;
  error.value = '';
  try {
    payload.value = await fetchSharedJourneyAlbum(shareToken);
    if (!payload.value) {
      error.value = t('shareJourneyAlbum.empty');
    }
  } catch (err) {
    error.value = getAppErrorMessage(err, t('shareJourneyAlbum.empty'));
    payload.value = null;
  } finally {
    loading.value = false;
  }
}

onLoad((query) => {
  shareToken = parseTokenFromQuery(query as Record<string, string | undefined>);
  if (shareToken) {
    void loadAlbum();
  } else {
    loading.value = false;
    error.value = t('shareJourneyAlbum.empty');
  }
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--dx-bg);
  padding-bottom: 48rpx;
}
.state,
.state-inner {
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
  min-height: 200rpx;
}
.hero-cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.65) 100%);
  z-index: 1;
}
.hero-inner {
  position: relative;
  z-index: 2;
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
.card {
  margin: 24rpx 32rpx 0;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 28rpx;
  box-shadow: var(--dx-shadow-sm);
}
.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-primary);
  margin-bottom: 16rpx;
}
.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
}
.photo-thumb {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12rpx;
  background: var(--dx-bg);
}
</style>
