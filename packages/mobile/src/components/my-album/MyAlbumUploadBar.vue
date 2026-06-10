<template>
  <view class="upload-bar">
    <button class="btn-upload" :loading="uploading" @click="openRoutePicker">
      {{ t('myAlbum.upload') }}
    </button>
  </view>

  <view v-if="routePickerOpen" class="picker-mask" @click="closeRoutePicker">
    <view class="picker-sheet" @click.stop>
      <text class="picker-title">{{ t('myAlbum.pickRouteTitle') }}</text>
      <text class="picker-hint">{{ t('myAlbum.pickRouteHint') }}</text>

      <view v-if="routesLoading" class="picker-state">{{ t('common.loading') }}</view>
      <view v-else-if="routes.length === 0" class="picker-empty">
        <text class="picker-state">{{ t('myAlbum.noRoutes') }}</text>
        <button class="btn-link" @click="goRoutes">{{ t('profile.actionRoutes') }}</button>
      </view>
      <scroll-view v-else scroll-y class="route-list" :show-scrollbar="false">
        <view
          v-for="route in routes"
          :key="route.id"
          class="route-item"
          @click="selectRoute(route.id)"
        >
          <text class="route-name">{{ route.name }}</text>
          <text class="route-meta">{{ tf('plan.intentDays', { days: route.days }) }}</text>
        </view>
      </scroll-view>

      <button class="btn-cancel" @click="closeRoutePicker">{{ t('common.cancel') }}</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { TravelRouteInfo } from '@douxing/shared';
import { fetchJourneyAlbumByRoute, uploadJourneyAlbumPhoto } from '@/api/journey-albums';
import { fetchRoutesPage } from '@/api/routes';
import { useTf } from '@/i18n/useTf';
import { getAppErrorMessage } from '@/utils/request';

const emit = defineEmits<{
  uploaded: [];
}>();

const { t, tf } = useTf();

const routePickerOpen = ref(false);
const routesLoading = ref(false);
const routes = ref<TravelRouteInfo[]>([]);
const uploading = ref(false);
const pendingRouteId = ref<number | null>(null);

async function openRoutePicker() {
  routePickerOpen.value = true;
  routesLoading.value = true;
  try {
    const result = await fetchRoutesPage({ scope: 'mine', page: 1, pageSize: 100 });
    routes.value = result.items;
  } catch {
    routes.value = [];
  } finally {
    routesLoading.value = false;
  }
}

function closeRoutePicker() {
  routePickerOpen.value = false;
  pendingRouteId.value = null;
}

function goRoutes() {
  closeRoutePicker();
  uni.switchTab({ url: '/pages/routes/list' });
}

async function selectRoute(routeId: number) {
  pendingRouteId.value = routeId;
  closeRoutePicker();
  try {
    const choose = await new Promise<UniApp.ChooseImageSuccessCallbackResult>((resolve, reject) => {
      uni.chooseImage({
        count: 9,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: resolve,
        fail: reject,
      });
    });
    const paths = choose.tempFilePaths ?? [];
    if (paths.length === 0) {
      pendingRouteId.value = null;
      return;
    }
    await uploadFiles(routeId, paths);
  } catch {
    pendingRouteId.value = null;
  }
}

async function uploadFiles(routeId: number, filePaths: string[]) {
  uploading.value = true;
  try {
    const album = await fetchJourneyAlbumByRoute(routeId);
    let successCount = 0;
    for (const filePath of filePaths) {
      try {
        await uploadJourneyAlbumPhoto(album.id, filePath);
        successCount += 1;
      } catch (e) {
        uni.showToast({
          title: getAppErrorMessage(e, t('myAlbum.uploadFailed')),
          icon: 'none',
        });
      }
    }
    if (successCount > 0) {
      uni.showToast({
        title: tf('myAlbum.uploadSuccess', { count: successCount }),
        icon: 'success',
      });
      emit('uploaded');
    }
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e, t('myAlbum.uploadFailed')), icon: 'none' });
  } finally {
    uploading.value = false;
    pendingRouteId.value = null;
  }
}
</script>

<style scoped>
.upload-bar {
  margin-bottom: 24rpx;
}
.btn-upload {
  width: 100%;
  margin: 0;
  background: var(--dx-primary);
  color: #fff;
  font-size: 28rpx;
  border-radius: var(--dx-radius-sm);
}
.picker-mask {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
}
.picker-sheet {
  width: 100%;
  max-height: 70vh;
  background: var(--dx-surface);
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.picker-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.picker-hint {
  display: block;
  margin-top: 8rpx;
  margin-bottom: 24rpx;
  font-size: 24rpx;
  color: var(--dx-text-secondary);
}
.picker-state {
  padding: 32rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: var(--dx-text-secondary);
}
.picker-empty {
  padding-bottom: 16rpx;
}
.btn-link {
  margin-top: 16rpx;
  background: var(--dx-primary);
  color: #fff;
  font-size: 28rpx;
  border-radius: var(--dx-radius-lg);
}
.route-list {
  max-height: 400rpx;
  margin-bottom: 24rpx;
}
.route-item {
  padding: 24rpx;
  margin-bottom: 12rpx;
  border: 1rpx solid var(--dx-border);
  border-radius: var(--dx-radius-md);
  background: var(--dx-bg);
}
.route-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.route-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--dx-text-secondary);
}
.btn-cancel {
  background: var(--dx-bg);
  color: var(--dx-text);
  font-size: 28rpx;
  border: 1rpx solid var(--dx-border);
  border-radius: var(--dx-radius-lg);
}
</style>
