<template>
  <view class="journey-album">
    <view v-if="loading" class="album-state">{{ t('common.loading') }}</view>
    <view v-else-if="loadError" class="album-state">{{ t('journeyAlbum.loadFailed') }}</view>
    <template v-else-if="album">
      <view class="storage-bar">
        <view class="storage-row">
          <text class="storage-label">{{ t('journeyAlbum.storageUsage') }}</text>
          <text class="storage-value">{{ storageSummary }}</text>
        </view>
        <view class="storage-track">
          <view class="storage-fill" :style="{ width: storagePercent + '%' }" />
        </view>
      </view>

      <view class="album-actions">
        <button class="btn-upload" :loading="uploading" @click="handleUpload">
          {{ t('journeyAlbum.upload') }}
        </button>
        <text class="album-count">{{ tf('journeyAlbum.photoCount', { count: album.photoCount }) }}</text>
      </view>

      <view v-if="unassignedPhotos.length > 0" class="album-section">
        <view class="section-head" @click="unassignedOpen = !unassignedOpen">
          <text class="section-title">{{ t('journeyAlbum.unassigned') }}</text>
          <text class="section-meta">{{ unassignedPhotos.length }}</text>
        </view>
        <view v-if="unassignedOpen" class="photo-grid">
          <view
            v-for="photo in unassignedPhotos"
            :key="photo.id"
            class="photo-cell"
            @click="openOrganize(photo)"
          >
            <image class="photo-thumb" :src="photo.storedUrl" mode="aspectFill" />
          </view>
        </view>
      </view>

      <view v-for="group in assignedGroups" :key="groupKey(group)" class="album-section">
        <view class="section-head" @click="toggleGroup(groupKey(group))">
          <text class="section-title">{{ groupTitle(group) }}</text>
          <text class="section-meta">{{ group.photos.length }}</text>
        </view>
        <view v-if="expandedGroups.has(groupKey(group))" class="photo-grid">
          <view
            v-for="photo in group.photos"
            :key="photo.id"
            class="photo-cell"
            @click="openOrganize(photo)"
          >
            <image class="photo-thumb" :src="photo.storedUrl" mode="aspectFill" />
          </view>
        </view>
      </view>

      <view v-if="album.photoCount === 0" class="album-empty">
        <text>{{ t('journeyAlbum.empty') }}</text>
        <text class="album-empty-hint">{{ t('journeyAlbum.emptyHint') }}</text>
      </view>
    </template>

    <view v-if="organizeVisible" class="organize-mask" @click="closeOrganize">
      <view class="organize-sheet" @click.stop>
        <text class="organize-title">{{ t('journeyAlbum.organizeTitle') }}</text>
        <image
          v-if="organizePhoto"
          class="organize-preview"
          :src="organizePhoto.storedUrl"
          mode="aspectFill"
        />

        <text class="organize-label">{{ t('journeyAlbum.dayLabel') }}</text>
        <scroll-view scroll-x class="chip-scroll" :show-scrollbar="false">
          <view class="chip-row">
            <view
              class="chip"
              :class="{ active: organizeDayIndex == null }"
              @click="organizeDayIndex = null"
            >
              <text>{{ t('journeyAlbum.unassignedShort') }}</text>
            </view>
            <view
              v-for="(day, index) in days"
              :key="index"
              class="chip"
              :class="{ active: organizeDayIndex === index }"
              @click="organizeDayIndex = index"
            >
              <text>{{ dayTabLabel(day, index) }}</text>
            </view>
          </view>
        </scroll-view>

        <text v-if="organizeDayIndex != null" class="organize-label">{{ t('journeyAlbum.poiLabel') }}</text>
        <scroll-view
          v-if="organizeDayIndex != null"
          scroll-x
          class="chip-scroll"
          :show-scrollbar="false"
        >
          <view class="chip-row">
            <view
              v-for="spot in poiOptions"
              :key="`${spot.name}-${spot.attractionId ?? 'x'}`"
              class="chip"
              :class="{ active: organizePoiName === spot.name }"
              @click="selectPoi(spot)"
            >
              <text>{{ spot.name }}</text>
            </view>
          </view>
        </scroll-view>

        <view class="organize-actions">
          <button class="btn-cancel" @click="closeOrganize">{{ t('common.cancel') }}</button>
          <button class="btn-save" :loading="savingOrganize" @click="saveOrganize">
            {{ t('common.save') }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { JourneyAlbumDetail, RouteDayAttraction, RouteDayPlan, TravelPhotoInfo } from '@douxing/shared';
import {
  fetchJourneyAlbumByRoute,
  fetchPhotoStorage,
  formatStorageBytes,
  getUnassignedPhotos,
  updateTravelPhotoMeta,
  uploadJourneyAlbumPhoto,
} from '@/api/journey-albums';
import { useTf } from '@/i18n/useTf';
import { getAppErrorMessage } from '@/utils/request';

const props = defineProps<{
  routeId: number;
  days: RouteDayPlan[];
  visible: boolean;
}>();

const { t, tf } = useTf();

const loading = ref(false);
const loadError = ref(false);
const uploading = ref(false);
const album = ref<JourneyAlbumDetail | null>(null);
const storageUsedBytes = ref(0);
const storageMaxBytes = ref(1);
const storageUsedCount = ref(0);
const storageMaxCount = ref(1);
const unassignedOpen = ref(true);
const expandedGroups = ref(new Set<string>());
const organizeVisible = ref(false);
const organizePhoto = ref<TravelPhotoInfo | null>(null);
const organizeDayIndex = ref<number | null>(null);
const organizePoiName = ref<string | null>(null);
const organizeAttractionId = ref<number | null>(null);
const savingOrganize = ref(false);

const unassignedPhotos = computed(() => getUnassignedPhotos(album.value));

const assignedGroups = computed(() =>
  (album.value?.groups ?? []).filter(
    (group) => group.dayIndex != null || Boolean(group.poiName?.trim()),
  ),
);

const storageSummary = computed(() =>
  tf('journeyAlbum.storageSummary', {
    usedBytes: formatStorageBytes(storageUsedBytes.value),
    maxBytes: formatStorageBytes(storageMaxBytes.value),
    usedCount: storageUsedCount.value,
    maxCount: storageMaxCount.value,
  }),
);

const storagePercent = computed(() => {
  const byteRatio = storageMaxBytes.value > 0 ? storageUsedBytes.value / storageMaxBytes.value : 0;
  const countRatio = storageMaxCount.value > 0 ? storageUsedCount.value / storageMaxCount.value : 0;
  return Math.min(100, Math.round(Math.max(byteRatio, countRatio) * 100));
});

const poiOptions = computed((): RouteDayAttraction[] => {
  if (organizeDayIndex.value == null) return [];
  return props.days[organizeDayIndex.value]?.attractions ?? [];
});

function dayTabLabel(day: RouteDayPlan, index: number): string {
  if (day.date?.trim()) return day.date;
  return tf('routes.flowDayTab', { day: index + 1 });
}

function groupKey(group: { dayIndex: number | null; poiName: string | null; attractionId: number | null }) {
  return `${group.dayIndex ?? 'null'}::${group.poiName ?? 'null'}::${group.attractionId ?? 'null'}`;
}

function groupTitle(group: { dayIndex: number | null; poiName: string | null }) {
  if (group.dayIndex != null && group.poiName) {
    return tf('journeyAlbum.groupDayPoi', { day: group.dayIndex + 1, poi: group.poiName });
  }
  if (group.dayIndex != null) {
    return tf('journeyAlbum.groupDayOnly', { day: group.dayIndex + 1 });
  }
  return group.poiName ?? t('journeyAlbum.unassigned');
}

function toggleGroup(key: string) {
  const next = new Set(expandedGroups.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedGroups.value = next;
}

async function loadAlbum() {
  loading.value = true;
  loadError.value = false;
  try {
    const [detail, storage] = await Promise.all([
      fetchJourneyAlbumByRoute(props.routeId),
      fetchPhotoStorage(),
    ]);
    album.value = detail;
    storageUsedBytes.value = storage.usedBytes;
    storageMaxBytes.value = storage.maxBytes;
    storageUsedCount.value = storage.usedCount;
    storageMaxCount.value = storage.maxCount;
    expandedGroups.value = new Set(detail.groups.map((group) => groupKey(group)));
  } catch {
    loadError.value = true;
    album.value = null;
  } finally {
    loading.value = false;
  }
}

async function handleUpload() {
  if (!album.value) return;
  try {
    const choose = await new Promise<UniApp.ChooseImageSuccessCallbackResult>((resolve, reject) => {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: resolve,
        fail: reject,
      });
    });
    const filePath = choose.tempFilePaths[0];
    if (!filePath) return;

    uploading.value = true;
    await uploadJourneyAlbumPhoto(album.value.id, filePath);
    uni.showToast({ title: t('journeyAlbum.uploadSuccess'), icon: 'success' });
    await loadAlbum();
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e, t('journeyAlbum.uploadFailed')), icon: 'none' });
  } finally {
    uploading.value = false;
  }
}

function openOrganize(photo: TravelPhotoInfo) {
  organizePhoto.value = photo;
  organizeDayIndex.value = photo.dayIndex;
  organizePoiName.value = photo.poiName;
  organizeAttractionId.value = photo.attractionId;
  organizeVisible.value = true;
}

function closeOrganize() {
  organizeVisible.value = false;
  organizePhoto.value = null;
}

function selectPoi(spot: RouteDayAttraction) {
  organizePoiName.value = spot.name;
  organizeAttractionId.value = spot.attractionId ?? null;
}

async function saveOrganize() {
  if (!album.value || !organizePhoto.value) return;
  savingOrganize.value = true;
  try {
    await updateTravelPhotoMeta(album.value.id, organizePhoto.value.id, {
      dayIndex: organizeDayIndex.value,
      poiName: organizeDayIndex.value == null ? null : organizePoiName.value,
      attractionId: organizeDayIndex.value == null ? null : organizeAttractionId.value,
    });
    uni.showToast({ title: t('journeyAlbum.organizeSuccess'), icon: 'success' });
    closeOrganize();
    await loadAlbum();
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e, t('journeyAlbum.organizeFailed')), icon: 'none' });
  } finally {
    savingOrganize.value = false;
  }
}

watch(
  () => [props.visible, props.routeId] as const,
  ([visible]) => {
    if (visible && props.routeId > 0) {
      loadAlbum();
    }
  },
  { immediate: true },
);

defineExpose({
  reload: loadAlbum,
  getAlbumDetail: () => album.value,
});
</script>

<style scoped>
.journey-album {
  padding: 8rpx 0 16rpx;
}
.album-state {
  padding: 48rpx 0;
  text-align: center;
  color: var(--dx-text-secondary);
  font-size: 26rpx;
}
.storage-bar {
  margin-bottom: 24rpx;
}
.storage-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.storage-label {
  font-size: 24rpx;
  color: var(--dx-text-secondary);
}
.storage-value {
  font-size: 22rpx;
  color: var(--dx-text);
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
.album-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.btn-upload {
  flex: 1;
  margin: 0;
  background: var(--dx-primary);
  color: #fff;
  font-size: 28rpx;
  border-radius: var(--dx-radius-sm);
}
.album-count {
  font-size: 24rpx;
  color: var(--dx-text-secondary);
  white-space: nowrap;
}
.album-section {
  margin-bottom: 20rpx;
  border: 1rpx solid var(--dx-border);
  border-radius: var(--dx-radius-sm);
  overflow: hidden;
}
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 24rpx;
  background: var(--dx-bg);
}
.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.section-meta {
  font-size: 24rpx;
  color: var(--dx-text-secondary);
}
.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 16rpx;
}
.photo-cell {
  width: calc((100% - 24rpx) / 3);
  aspect-ratio: 1;
  border-radius: 12rpx;
  overflow: hidden;
  background: var(--dx-border);
}
.photo-thumb {
  width: 100%;
  height: 100%;
}
.album-empty {
  padding: 48rpx 24rpx;
  text-align: center;
  color: var(--dx-text-secondary);
  font-size: 26rpx;
}
.album-empty-hint {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
}
.organize-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}
.organize-sheet {
  width: 100%;
  max-height: 80vh;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-xl) var(--dx-radius-xl) 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.organize-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: var(--dx-text);
  margin-bottom: 20rpx;
}
.organize-preview {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  margin-bottom: 24rpx;
}
.organize-label {
  display: block;
  font-size: 24rpx;
  color: var(--dx-text-secondary);
  margin: 16rpx 0 12rpx;
}
.chip-scroll {
  white-space: nowrap;
  margin-bottom: 8rpx;
}
.chip-row {
  display: inline-flex;
  gap: 12rpx;
  padding-bottom: 8rpx;
}
.chip {
  display: inline-flex;
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: var(--dx-bg);
  color: var(--dx-text-secondary);
  font-size: 24rpx;
  border: 1rpx solid var(--dx-border);
}
.chip.active {
  background: var(--dx-primary-light);
  color: var(--dx-primary);
  border-color: var(--dx-primary-border);
  font-weight: 600;
}
.organize-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 28rpx;
}
.btn-cancel,
.btn-save {
  flex: 1;
  margin: 0;
  font-size: 28rpx;
  border-radius: var(--dx-radius-sm);
}
.btn-cancel {
  background: var(--dx-bg);
  color: var(--dx-text);
}
.btn-save {
  background: var(--dx-primary);
  color: #fff;
}
</style>
