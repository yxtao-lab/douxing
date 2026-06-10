<template>
  <SubPageShell
    :title="pageTitle"
    :description="pageDesc"
    :back-to="{ name: 'journey-albums' }"
    :back-label="t('nav.myAlbum')"
  >
    <template #actions>
      <div class="flex flex-wrap items-center gap-3">
        <RouterLink
          v-if="album?.routeId"
          :to="{ name: 'route-detail', params: { id: album.routeId } }"
          class="text-sm text-dx-primary hover:underline"
        >
          {{ t('myAlbum.viewRoute') }}
        </RouterLink>
        <button
          v-if="album"
          type="button"
          class="text-sm text-red-600 hover:underline"
          :disabled="deletingAlbum"
          @click="handleDeleteAlbum"
        >
          {{ deletingAlbum ? t('common.loading') : t('myAlbum.deleteAlbum') }}
        </button>
      </div>
    </template>

    <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('common.loading') }}</div>
    <div v-else-if="loadError" class="dx-card text-center">
      <p class="mb-4 text-red-600">{{ loadError }}</p>
      <button type="button" class="dx-btn-secondary" @click="loadAlbum">{{ t('common.refresh') }}</button>
    </div>
    <template v-else-if="album">
      <p v-if="album.routeName" class="mb-4 text-sm text-dx-muted">
        {{ t('myAlbum.linkedRoute', { name: album.routeName }) }}
      </p>

      <AlbumPhotoUploadBar :album-id="album.id" @uploaded="handleUploaded" />

      <p class="mb-4 text-sm text-dx-muted">
        {{ t('journeyAlbum.photoCount', { count: album.photoCount }) }}
      </p>

      <div v-if="album.photoCount === 0" class="dx-card text-center">
        <p class="text-dx-text">{{ t('journeyAlbum.empty') }}</p>
        <p class="mt-2 text-sm text-dx-muted">{{ t('journeyAlbum.emptyHint') }}</p>
      </div>
      <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div
          v-for="photo in album.photos"
          :key="photo.id"
          class="group relative overflow-hidden rounded-xl border border-dx-border bg-white shadow-card"
        >
          <button
            type="button"
            class="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-sm text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
            :title="t('myAlbum.deletePhoto')"
            :disabled="deletingPhotoId === photo.id"
            @click.stop="handleDeletePhoto(photo.id)"
          >
            ×
          </button>
          <button type="button" class="block w-full" @click="openPreview(photo)">
            <img :src="photo.storedUrl" alt="" class="aspect-square w-full object-cover" />
            <p v-if="photoMeta(photo)" class="truncate px-2 py-1.5 text-xs text-dx-muted">
              {{ photoMeta(photo) }}
            </p>
          </button>
        </div>
      </div>
    </template>

    <PhotoPreviewLightbox
      :open="previewOpen"
      :urls="previewUrls"
      :initial-index="previewIndex"
      @close="closePreview"
      @update:initial-index="previewIndex = $event"
    />
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { JourneyAlbumDetail, TravelPhotoInfo } from '@douxing/shared';
import {
  deleteJourneyAlbum,
  deleteTravelPhoto,
  fetchJourneyAlbumDetail,
  fetchPhotoStorage,
} from '@/api/journey-albums';
import AlbumPhotoUploadBar from '@/components/journey-album/AlbumPhotoUploadBar.vue';
import PhotoPreviewLightbox from '@/components/PhotoPreviewLightbox.vue';
import SubPageShell from '@/components/SubPageShell.vue';
import { appMessage } from '@/composables/useAppMessage';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';

const vueRoute = useRoute();
const router = useRouter();
const { t } = useLocale();

const album = ref<JourneyAlbumDetail | null>(null);
const loading = ref(false);
const loadError = ref('');
const deletingAlbum = ref(false);
const deletingPhotoId = ref<number | null>(null);
const previewOpen = ref(false);
const previewIndex = ref(0);

const previewUrls = computed(() => album.value?.photos.map((photo) => photo.storedUrl) ?? []);

const albumId = computed(() => {
  const raw = vueRoute.params.albumId;
  const id = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  return Number.isFinite(id) && id > 0 ? id : 0;
});

const pageTitle = computed(() => album.value?.title || t('nav.myAlbum'));

const pageDesc = computed(() => {
  if (album.value?.routeName) {
    return t('myAlbum.linkedRoute', { name: album.value.routeName });
  }
  return t('myAlbum.detailDesc');
});

function photoMeta(photo: TravelPhotoInfo): string {
  if (photo.dayIndex != null && photo.poiName) {
    return t('myAlbum.poiMeta', { day: photo.dayIndex + 1, poi: photo.poiName });
  }
  if (photo.dayIndex != null) {
    return t('myAlbum.dayOnlyMeta', { day: photo.dayIndex + 1 });
  }
  if (photo.poiName) return photo.poiName;
  return '';
}

function openPreview(photo: TravelPhotoInfo) {
  const index = album.value?.photos.findIndex((item) => item.id === photo.id) ?? 0;
  previewIndex.value = index >= 0 ? index : 0;
  previewOpen.value = true;
}

function closePreview() {
  previewOpen.value = false;
}

async function loadAlbum() {
  if (albumId.value <= 0) {
    loadError.value = t('journeyAlbum.loadFailed');
    return;
  }
  loading.value = true;
  loadError.value = '';
  try {
    album.value = await fetchJourneyAlbumDetail(albumId.value);
  } catch (err) {
    loadError.value = getAppErrorMessage(err, t('journeyAlbum.loadFailed'));
    album.value = null;
  } finally {
    loading.value = false;
  }
}

async function handleUploaded() {
  await Promise.all([loadAlbum(), loadStorageQuietly()]);
}

async function loadStorageQuietly() {
  try {
    await fetchPhotoStorage();
  } catch {
    /* ignore */
  }
}

async function handleDeletePhoto(photoId: number) {
  if (!album.value) return;
  if (!window.confirm(t('myAlbum.deletePhotoConfirm'))) return;

  deletingPhotoId.value = photoId;
  try {
    await deleteTravelPhoto(album.value.id, photoId);
    appMessage.success(t('myAlbum.deletePhotoSuccess'));
    if (previewOpen.value) {
      const deletedIndex = album.value.photos.findIndex((item) => item.id === photoId);
      if (deletedIndex >= 0 && deletedIndex === previewIndex.value) {
        closePreview();
      }
    }
    await Promise.all([loadAlbum(), loadStorageQuietly()]);
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('myAlbum.deletePhotoFailed')));
  } finally {
    deletingPhotoId.value = null;
  }
}

async function handleDeleteAlbum() {
  if (!album.value) return;
  if (!window.confirm(t('myAlbum.deleteAlbumConfirm'))) return;

  deletingAlbum.value = true;
  try {
    await deleteJourneyAlbum(album.value.id);
    appMessage.success(t('myAlbum.deleteAlbumSuccess'));
    await router.push({ name: 'journey-albums' });
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('myAlbum.deleteAlbumFailed')));
  } finally {
    deletingAlbum.value = false;
  }
}

watch(albumId, () => {
  void loadAlbum();
});

onMounted(() => {
  void loadAlbum();
});
</script>
