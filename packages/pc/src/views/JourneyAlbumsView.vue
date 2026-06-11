<template>
  <SubPageShell
    :title="t('nav.myAlbum')"
    :description="t('myAlbum.desc')"
    :back-to="{ name: 'profile' }"
    :back-label="t('pc.nav.profile')"
  >
    <div v-if="storageSummary" class="mb-4 rounded-xl border border-dx-border bg-dx-bg p-4">
      <p class="mb-2 text-sm text-dx-text">{{ storageSummary }}</p>
      <div class="h-2 overflow-hidden rounded-full bg-dx-border">
        <div
          class="h-full rounded-full bg-dx-primary transition-all"
          :style="{ width: `${storagePercent}%` }"
        />
      </div>
    </div>

    <MyAlbumCreateBar :linked-route-ids="linkedRouteIds" @created="handleAlbumCreated" />

    <div v-if="loading && albums.length === 0" class="dx-card text-center text-dx-muted">
      {{ t('common.loading') }}
    </div>
    <div v-else-if="loadError && albums.length === 0" class="dx-card text-center">
      <p class="mb-4 text-red-600">{{ loadError }}</p>
      <button type="button" class="dx-btn-secondary" @click="reload">{{ t('common.refresh') }}</button>
    </div>
    <div v-else-if="albums.length === 0" class="dx-card text-center">
      <p class="mb-2 text-dx-text">{{ t('myAlbum.empty') }}</p>
      <p class="mb-4 text-sm text-dx-muted">{{ t('myAlbum.emptyHint') }}</p>
      <RouterLink :to="{ name: 'routes' }" class="dx-btn-primary">{{ t('profile.actionRoutes') }}</RouterLink>
    </div>
    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <div
        v-for="album in albums"
        :key="album.id"
        class="group relative overflow-hidden rounded-xl border border-dx-border bg-white shadow-card transition hover:border-dx-primary/40 hover:shadow-md"
      >
        <button
          type="button"
          class="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-sm text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
          :title="t('myAlbum.deleteAlbum')"
          :disabled="deletingAlbumId === album.id"
          @click="handleDeleteAlbum(album)"
        >
          ×
        </button>
        <RouterLink
          :to="{ name: 'journey-album-detail', params: { albumId: album.id } }"
          class="block"
        >
          <div class="relative aspect-[4/3] overflow-hidden bg-dx-bg">
            <img
              v-if="album.coverPhotoUrl"
              :src="album.coverPhotoUrl"
              alt=""
              class="h-full w-full object-cover transition group-hover:scale-105"
            />
            <div
              v-else
              class="flex h-full w-full flex-col items-center justify-center gap-2 text-dx-muted"
            >
              <span class="text-3xl">📷</span>
              <span class="text-xs">{{ t('myAlbum.noCover') }}</span>
            </div>
            <span
              class="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white"
            >
              {{ t('myAlbum.albumPhotoCount', { count: album.photoCount }) }}
            </span>
          </div>
          <div class="space-y-1 p-3">
            <p class="truncate text-sm font-semibold text-dx-text group-hover:text-dx-primary">
              {{ album.title }}
            </p>
            <p class="truncate text-xs text-dx-muted">
              {{ t('myAlbum.linkedRoute', { name: album.routeName || '—' }) }}
            </p>
            <p class="text-xs text-dx-muted">{{ formatUpdatedAt(album.updatedAt) }}</p>
          </div>
        </RouterLink>
      </div>
    </div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { JourneyAlbumSummary } from '@douxing/shared';
import {
  deleteJourneyAlbum,
  fetchJourneyAlbums,
  fetchPhotoStorage,
  formatStorageBytes,
} from '@/api/journey-albums';
import MyAlbumCreateBar from '@/components/journey-album/MyAlbumCreateBar.vue';
import SubPageShell from '@/components/SubPageShell.vue';
import { appDialog } from '@/composables/useAppDialog';
import { appMessage } from '@/composables/useAppMessage';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';

const router = useRouter();
const { t } = useLocale();

const albums = ref<JourneyAlbumSummary[]>([]);
const loading = ref(false);
const loadError = ref('');
const deletingAlbumId = ref<number | null>(null);

const linkedRouteIds = computed(() => albums.value.map((album) => album.routeId));

const storageUsedBytes = ref(0);
const storageMaxBytes = ref(1);
const storageUsedCount = ref(0);
const storageMaxCount = ref(1);

const storageSummary = computed(() =>
  t('journeyAlbum.storageSummary', {
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

function formatUpdatedAt(iso: string) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
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

async function reload() {
  loading.value = true;
  loadError.value = '';
  try {
    albums.value = await fetchJourneyAlbums();
  } catch (err) {
    loadError.value = getAppErrorMessage(err, t('journeyAlbum.loadFailed'));
    albums.value = [];
  } finally {
    loading.value = false;
  }
}

async function handleAlbumCreated(albumId: number) {
  await Promise.all([reload(), loadStorage()]);
  await router.push({ name: 'journey-album-detail', params: { albumId } });
}

async function handleDeleteAlbum(album: JourneyAlbumSummary) {
  const confirmed = await appDialog.confirm({
    content: t('myAlbum.deleteAlbumConfirm'),
    danger: true,
  });
  if (!confirmed) return;

  deletingAlbumId.value = album.id;
  try {
    await deleteJourneyAlbum(album.id);
    appMessage.success(t('myAlbum.deleteAlbumSuccess'));
    await Promise.all([reload(), loadStorage()]);
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('myAlbum.deleteAlbumFailed')));
  } finally {
    deletingAlbumId.value = null;
  }
}

onMounted(async () => {
  await Promise.all([reload(), loadStorage()]);
});
</script>
