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

    <div v-if="loading && items.length === 0" class="dx-card text-center text-dx-muted">
      {{ t('common.loading') }}
    </div>
    <div v-else-if="items.length === 0" class="dx-card text-center">
      <p class="mb-2 text-dx-text">{{ t('myAlbum.empty') }}</p>
      <p class="mb-4 text-sm text-dx-muted">{{ t('myAlbum.emptyHint') }}</p>
      <RouterLink :to="{ name: 'routes' }" class="dx-btn-primary">{{ t('profile.actionRoutes') }}</RouterLink>
    </div>
    <div v-else>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <div
          v-for="item in items"
          :key="item.id"
          class="overflow-hidden rounded-xl border border-dx-border bg-white shadow-card"
        >
          <button type="button" class="block w-full" @click="openPreview(item)">
            <img :src="item.storedUrl" alt="" class="aspect-square w-full object-cover" />
          </button>
          <div class="space-y-1 p-3">
            <RouterLink
              :to="{ name: 'route-detail', params: { id: item.routeId } }"
              class="block truncate text-sm font-semibold text-dx-primary hover:underline"
            >
              {{ item.routeName || item.albumTitle }}
            </RouterLink>
            <p class="truncate text-xs text-dx-muted">{{ photoMeta(item) }}</p>
          </div>
        </div>
      </div>
      <div class="mt-6 text-center">
        <button v-if="hasMore" type="button" class="dx-btn-secondary" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? t('common.loading') : t('common.loadMore') }}
        </button>
        <p v-else class="text-sm text-dx-muted">{{ t('common.noMore') }}</p>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="previewItem"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        @click="previewItem = null"
      >
        <img
          :src="previewItem.storedUrl"
          alt=""
          class="max-h-[85vh] max-w-full rounded-xl object-contain"
          @click.stop
        />
      </div>
    </Teleport>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { UserTravelPhotoListItem } from '@douxing/shared';
import {
  fetchPhotoStorage,
  fetchTravelPhotosPage,
  formatStorageBytes,
} from '@/api/journey-albums';
import SubPageShell from '@/components/SubPageShell.vue';
import { useLocale } from '@/i18n/useLocale';

const { t } = useLocale();

const items = ref<UserTravelPhotoListItem[]>([]);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);
const loading = ref(false);
const loadingMore = ref(false);
const previewItem = ref<UserTravelPhotoListItem | null>(null);

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

function photoMeta(item: UserTravelPhotoListItem): string {
  if (item.dayIndex != null && item.poiName) {
    return t('myAlbum.poiMeta', { day: item.dayIndex + 1, poi: item.poiName });
  }
  if (item.dayIndex != null) {
    return t('myAlbum.dayOnlyMeta', { day: item.dayIndex + 1 });
  }
  if (item.poiName) return item.poiName;
  return t('journeyAlbum.unassigned');
}

function openPreview(item: UserTravelPhotoListItem) {
  previewItem.value = item;
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

async function fetchPage(nextPage: number, append: boolean) {
  if (append) loadingMore.value = true;
  else loading.value = true;
  try {
    const result = await fetchTravelPhotosPage({ page: nextPage, pageSize });
    items.value = append ? [...items.value, ...result.items] : result.items;
    page.value = nextPage;
    hasMore.value = result.hasMore;
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return;
  await fetchPage(page.value + 1, true);
}

onMounted(async () => {
  await Promise.all([fetchPage(1, false), loadStorage()]);
});
</script>
