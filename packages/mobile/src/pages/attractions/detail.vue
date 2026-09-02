<template>
  <view class="page" :class="themeClass">
    <DouxingEmptyState v-if="loading" loading embedded :title="t('common.loading')" />
    <DouxingEmptyState
      v-else-if="error"
      variant="error"
      embedded
      :title="error"
      :action-label="t('common.refresh')"
      @action="loadDetail"
    />
    <scroll-view v-else-if="detail" scroll-y class="page-scroll" enable-back-to-top>
      <view class="cover-wrap">
        <image
          v-if="detail.coverImageUrl"
          class="cover"
          :src="detail.coverImageUrl"
          mode="aspectFill"
        />
        <view v-else class="cover cover--placeholder">
          <text class="cover-placeholder">📍</text>
        </view>
      </view>

      <view class="body">
        <text class="name">{{ detail.name }}</text>
        <text class="city">{{ detail.city }}</text>

        <view class="meta-row">
          <view class="meta-item">
            <text class="meta-label">{{ t('attractions.ticketLabel') }}</text>
            <text class="meta-value">{{ ticketText }}</text>
          </view>
          <view class="meta-item">
            <text class="meta-label">{{ t('attractions.openHoursLabel') }}</text>
            <text class="meta-value">{{ openHoursText }}</text>
          </view>
        </view>

        <text class="section-title">{{ t('attractions.descriptionLabel') }}</text>
        <text class="desc">{{ detail.description || t('attractions.descriptionEmpty') }}</text>

        <template v-if="displayTags.length > 0">
          <text class="section-title">{{ t('attractions.tagsLabel') }}</text>
          <view class="tag-row">
            <text v-for="tag in displayTags" :key="tag" class="tag">{{ tag }}</text>
          </view>
        </template>

        <button
          v-if="hasLocation"
          class="map-btn"
          hover-class="map-btn--hover"
          @click="openMap"
        >
          {{ t('attractions.openMap') }}
        </button>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import type { AttractionInfo } from '@douxing/shared';
import { fetchAttractionDetail } from '@/api/attractions';
import DouxingEmptyState from '@/components/douxing-empty-state/DouxingEmptyState.vue';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';
import { getAppErrorMessage } from '@/utils/request';

usePageTitle('nav.attractionDetail');
const { themeClass } = useTheme();
const { t, tf } = useTf();

const attractionId = ref(0);
const loading = ref(true);
const error = ref('');
const detail = ref<AttractionInfo | null>(null);

const hasLocation = computed(() => {
  const d = detail.value;
  return d != null && d.latitude != null && d.longitude != null;
});

const ticketText = computed(() => {
  const price = detail.value?.ticketPrice ?? 0;
  if (price <= 0) return t('attractions.freeTicket');
  return tf('attractions.ticketValue', { price });
});

const openHoursText = computed(() => {
  const windows = detail.value?.openHours?.windows ?? [];
  if (windows.length === 0) return t('attractions.openHoursAllDay');
  return windows.map((w) => `${w.open}-${w.close}`).join(' · ');
});

const displayTags = computed(() => (detail.value?.tags ?? []).slice(0, 8));

/**
 * 拉取景点详情。
 *
 * @returns void
 */
async function loadDetail() {
  if (!attractionId.value) {
    error.value = t('attractions.loadFailed');
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    detail.value = await fetchAttractionDetail(attractionId.value);
  } catch (e) {
    detail.value = null;
    error.value = getAppErrorMessage(e, t('attractions.loadFailed'));
  } finally {
    loading.value = false;
  }
}

/**
 * 在系统地图中打开景点坐标。
 *
 * @returns void
 */
function openMap() {
  const d = detail.value;
  if (!d || d.latitude == null || d.longitude == null) {
    uni.showToast({ title: t('attractions.noLocation'), icon: 'none' });
    return;
  }
  uni.openLocation({
    latitude: Number(d.latitude),
    longitude: Number(d.longitude),
    name: d.name,
    address: d.city,
    scale: 16,
  });
}

onLoad((query) => {
  const id = Number(query?.id ?? 0);
  attractionId.value = Number.isFinite(id) && id > 0 ? id : 0;
  void loadDetail();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--dx-bg);
  display: flex;
  flex-direction: column;
}

.page-scroll {
  flex: 1;
  height: 100vh;
}

.cover-wrap {
  width: 100%;
  height: 360rpx;
  background: var(--dx-bg-muted, #f0f0f0);
}

.cover {
  width: 100%;
  height: 360rpx;
}

.cover--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, var(--dx-primary-light), var(--dx-bg));
}

.cover-placeholder {
  font-size: 72rpx;
}

.body {
  padding: 28rpx 32rpx 64rpx;
  box-sizing: border-box;
}

.name {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: var(--dx-text);
  line-height: 1.3;
}

.city {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: var(--dx-text-muted);
}

.meta-row {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.meta-item {
  flex: 1;
  padding: 20rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md, 16rpx);
  box-shadow: var(--dx-shadow-sm);
}

.meta-label {
  display: block;
  font-size: 22rpx;
  color: var(--dx-text-muted);
}

.meta-value {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--dx-text);
  line-height: 1.35;
}

.section-title {
  display: block;
  margin-top: 32rpx;
  margin-bottom: 12rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
}

.desc {
  display: block;
  font-size: 26rpx;
  line-height: 1.6;
  color: var(--dx-text-secondary, var(--dx-text-muted));
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.tag {
  font-size: 22rpx;
  color: var(--dx-primary);
  background: var(--dx-primary-light);
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
}

.map-btn {
  margin-top: 40rpx;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 999rpx;
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
  font-size: 28rpx;
  font-weight: 600;
  border: none;
}

.map-btn--hover {
  opacity: 0.9;
}

.map-btn::after {
  border: none;
}
</style>
