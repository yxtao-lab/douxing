<template>
  <div>
    <div v-if="loading" class="py-8 text-center text-sm text-dx-muted">{{ t('common.loading') }}</div>
    <div v-else-if="loadError" class="py-8 text-center text-sm text-red-600">
      {{ t('journeyAlbum.loadFailed') }}
    </div>
    <template v-else-if="album">
      <div class="mb-4 rounded-xl border border-dx-border bg-dx-bg p-4">
        <div class="mb-2 flex items-center justify-between text-sm">
          <span class="text-dx-muted">{{ t('journeyAlbum.storageUsage') }}</span>
          <span class="text-dx-text">{{ storageSummary }}</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-dx-border">
          <div
            class="h-full rounded-full bg-dx-primary transition-all"
            :style="{ width: `${storagePercent}%` }"
          />
        </div>
      </div>

      <div class="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" class="dx-btn-primary" :disabled="uploading" @click="triggerUpload">
          {{ uploading ? t('common.loading') : t('journeyAlbum.upload') }}
        </button>
        <span class="text-sm text-dx-muted">
          {{ t('journeyAlbum.photoCount', { count: album.photoCount }) }}
        </span>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileChange"
        />
      </div>

      <div v-if="unassignedPhotos.length > 0" class="mb-4 rounded-xl border border-dx-border">
        <button
          type="button"
          class="flex w-full items-center justify-between px-4 py-3 text-left"
          @click="unassignedOpen = !unassignedOpen"
        >
          <span class="font-medium text-dx-text">{{ t('journeyAlbum.unassigned') }}</span>
          <span class="text-sm text-dx-muted">{{ unassignedPhotos.length }}</span>
        </button>
        <div v-if="unassignedOpen" class="grid grid-cols-3 gap-2 border-t border-dx-border p-3 sm:grid-cols-4 md:grid-cols-5">
          <button
            v-for="photo in unassignedPhotos"
            :key="photo.id"
            type="button"
            class="aspect-square overflow-hidden rounded-lg bg-dx-border"
            @click="openOrganize(photo)"
          >
            <img :src="photo.storedUrl" alt="" class="h-full w-full object-cover" />
          </button>
        </div>
      </div>

      <div
        v-for="group in assignedGroups"
        :key="groupKey(group)"
        class="mb-4 rounded-xl border border-dx-border"
      >
        <button
          type="button"
          class="flex w-full items-center justify-between px-4 py-3 text-left"
          @click="toggleGroup(groupKey(group))"
        >
          <span class="font-medium text-dx-text">{{ groupTitle(group) }}</span>
          <span class="text-sm text-dx-muted">{{ group.photos.length }}</span>
        </button>
        <div
          v-if="expandedGroups.has(groupKey(group))"
          class="grid grid-cols-3 gap-2 border-t border-dx-border p-3 sm:grid-cols-4 md:grid-cols-5"
        >
          <button
            v-for="photo in group.photos"
            :key="photo.id"
            type="button"
            class="aspect-square overflow-hidden rounded-lg bg-dx-border"
            @click="openOrganize(photo)"
          >
            <img :src="photo.storedUrl" alt="" class="h-full w-full object-cover" />
          </button>
        </div>
      </div>

      <div v-if="album.photoCount === 0" class="py-10 text-center">
        <p class="text-dx-text">{{ t('journeyAlbum.empty') }}</p>
        <p class="mt-2 text-sm text-dx-muted">{{ t('journeyAlbum.emptyHint') }}</p>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="organizeVisible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="closeOrganize"
      >
        <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" @click.stop>
          <h3 class="mb-4 text-lg font-semibold text-dx-text">{{ t('journeyAlbum.organizeTitle') }}</h3>
          <img
            v-if="organizePhoto"
            :src="organizePhoto.storedUrl"
            alt=""
            class="mb-4 h-32 w-32 rounded-xl object-cover"
          />

          <p class="mb-2 text-sm font-medium text-dx-text">{{ t('journeyAlbum.dayLabel') }}</p>
          <div class="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-full border px-3 py-1.5 text-sm transition"
              :class="organizeDayIndex == null ? 'border-dx-primary bg-dx-primary-light text-dx-primary' : 'border-dx-border text-dx-muted hover:border-dx-primary/40'"
              @click="organizeDayIndex = null"
            >
              {{ t('journeyAlbum.unassignedShort') }}
            </button>
            <button
              v-for="(day, index) in days"
              :key="index"
              type="button"
              class="rounded-full border px-3 py-1.5 text-sm transition"
              :class="organizeDayIndex === index ? 'border-dx-primary bg-dx-primary-light text-dx-primary' : 'border-dx-border text-dx-muted hover:border-dx-primary/40'"
              @click="organizeDayIndex = index"
            >
              {{ dayTabLabel(day, index) }}
            </button>
          </div>

          <template v-if="organizeDayIndex != null">
            <p class="mb-2 text-sm font-medium text-dx-text">{{ t('journeyAlbum.poiLabel') }}</p>
            <div class="mb-6 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              <button
                v-for="spot in poiOptions"
                :key="`${spot.name}-${spot.attractionId ?? 'x'}`"
                type="button"
                class="rounded-full border px-3 py-1.5 text-sm transition"
                :class="organizePoiName === spot.name ? 'border-dx-primary bg-dx-primary-light text-dx-primary' : 'border-dx-border text-dx-muted hover:border-dx-primary/40'"
                @click="selectPoi(spot)"
              >
                {{ spot.name }}
              </button>
            </div>
          </template>

          <div class="flex justify-end gap-3">
            <button type="button" class="dx-btn-secondary" @click="closeOrganize">
              {{ t('common.cancel') }}
            </button>
            <button type="button" class="dx-btn-primary" :disabled="savingOrganize" @click="saveOrganize">
              {{ t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type {
  JourneyAlbumDetail,
  RouteDayAttraction,
  RouteDayPlan,
  TravelPhotoInfo,
} from '@douxing/shared';
import {
  fetchJourneyAlbumByRoute,
  fetchPhotoStorage,
  formatStorageBytes,
  getUnassignedPhotos,
  updateTravelPhotoMeta,
  uploadJourneyAlbumPhoto,
} from '@/api/journey-albums';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';

const props = defineProps<{
  routeId: number;
  days: RouteDayPlan[];
  visible: boolean;
}>();

const { t } = useLocale();

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
const fileInputRef = ref<HTMLInputElement | null>(null);

const unassignedPhotos = computed(() => getUnassignedPhotos(album.value));

const assignedGroups = computed(() =>
  (album.value?.groups ?? []).filter(
    (group) => group.dayIndex != null || Boolean(group.poiName?.trim()),
  ),
);

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

const poiOptions = computed((): RouteDayAttraction[] => {
  if (organizeDayIndex.value == null) return [];
  return props.days[organizeDayIndex.value]?.attractions ?? [];
});

function dayTabLabel(day: RouteDayPlan, index: number): string {
  if (day.date?.trim()) return day.date;
  return t('routes.flowDayTab', { day: index + 1 });
}

function groupKey(group: {
  dayIndex: number | null;
  poiName: string | null;
  attractionId: number | null;
}) {
  return `${group.dayIndex ?? 'null'}::${group.poiName ?? 'null'}::${group.attractionId ?? 'null'}`;
}

function groupTitle(group: { dayIndex: number | null; poiName: string | null }) {
  if (group.dayIndex != null && group.poiName) {
    return t('journeyAlbum.groupDayPoi', { day: group.dayIndex + 1, poi: group.poiName });
  }
  if (group.dayIndex != null) {
    return t('journeyAlbum.groupDayOnly', { day: group.dayIndex + 1 });
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

function triggerUpload() {
  fileInputRef.value?.click();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !album.value) return;

  uploading.value = true;
  try {
    await uploadJourneyAlbumPhoto(album.value.id, file);
    await loadAlbum();
  } catch (err) {
    window.alert(getAppErrorMessage(err, t('journeyAlbum.uploadFailed')));
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
    closeOrganize();
    await loadAlbum();
  } catch (err) {
    window.alert(getAppErrorMessage(err, t('journeyAlbum.organizeFailed')));
  } finally {
    savingOrganize.value = false;
  }
}

watch(
  () => [props.visible, props.routeId] as const,
  ([visible]) => {
    if (visible && props.routeId > 0) {
      void loadAlbum();
    }
  },
  { immediate: true },
);

defineExpose({
  reload: loadAlbum,
  getAlbumDetail: () => album.value,
});
</script>
