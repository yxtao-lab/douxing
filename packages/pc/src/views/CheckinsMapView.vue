<template>
  <div class="checkin-map-page mx-auto flex h-[calc(100dvh-4rem)] max-w-7xl flex-col overflow-hidden px-4 py-3 lg:px-8">
    <div class="mb-3 shrink-0">
      <RouterLink
        :to="{ name: 'profile' }"
        class="mb-3 inline-flex items-center text-sm text-dx-primary hover:underline"
      >
        ← {{ t('pc.nav.profile') }}
      </RouterLink>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-dx-text">{{ t('checkinMap.title') }}</h1>
          <p class="mt-1 text-sm text-dx-muted">{{ t('checkinMap.desc') }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="dx-btn-secondary !px-4 !py-2" @click="resetMapView">
            {{ t('checkinMap.nationalView') }}
          </button>
          <button type="button" class="dx-btn-secondary !px-4 !py-2" @click="loadList">
            {{ t('common.refresh') }}
          </button>
          <RouterLink :to="{ name: 'checkins' }" class="text-sm text-dx-primary hover:underline">
            {{ t('checkinMap.listLink') }}
          </RouterLink>
        </div>
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-3">
      <div class="flex shrink-0 flex-col gap-2">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="opt in timeRangeOptions"
            :key="opt.value"
            type="button"
            class="rounded-full px-3 py-1 text-xs"
            :class="timeRange === opt.value ? 'bg-dx-primary text-white' : 'bg-gray-100 text-dx-muted'"
            @click="timeRange = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
        <p class="text-sm text-dx-text">
          {{ statsLine }}
          <span v-if="hiddenCount > 0" class="text-dx-muted">{{ hiddenHint }}</span>
        </p>
      </div>

      <p
        v-if="error"
        class="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ error }}
      </p>

      <div class="map-layout min-h-0 flex-1">
        <div class="map-panel dx-card flex min-h-0 flex-col !p-2">
          <div v-if="loading" class="flex flex-1 items-center justify-center text-dx-muted">
            {{ t('common.loading') }}
          </div>
          <CheckInMap
            v-else
            ref="checkInMapRef"
            class="min-h-0 flex-1"
            :items="filteredList"
            :selected-id="selectedId"
            @select="selectedId = $event"
          />
        </div>

        <aside class="side-panel dx-card flex flex-col overflow-hidden !p-0">
          <div class="flex items-center justify-between border-b border-dx-border px-4 py-3">
            <h2 class="text-sm font-semibold text-dx-text">{{ t('checkinMap.listTitle') }}</h2>
            <button
              type="button"
              class="text-xs text-dx-primary hover:underline"
              @click="filterVisible = !filterVisible"
            >
              {{ filterVisible ? t('checkinMap.hideFilter') : t('checkinMap.showFilter') }}
            </button>
          </div>

          <div v-show="filterVisible" class="space-y-3 border-b border-dx-border bg-dx-bg px-4 py-3">
            <div>
              <label class="mb-1 block text-xs text-dx-muted">{{ t('checkinMap.filterProvince') }}</label>
              <select
                v-model="provinceCode"
                class="w-full rounded-lg border border-dx-border bg-white px-3 py-2 text-sm"
              >
                <option value="">{{ t('common.filterAll') }}</option>
                <option v-for="opt in cityOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div v-if="provinceCode">
              <label class="mb-1 block text-xs text-dx-muted">{{ t('checkinMap.filterCity') }}</label>
              <select
                v-model="cityCode"
                class="w-full rounded-lg border border-dx-border bg-white px-3 py-2 text-sm"
              >
                <option value="">{{ t('common.filterAll') }}</option>
                <option v-for="opt in cityChildren" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs text-dx-muted">{{ t('checkinMap.filterPlace') }}</label>
              <input
                v-model="filterDraft.placeName"
                type="text"
                class="w-full rounded-lg border border-dx-border px-3 py-2 text-sm"
                :placeholder="t('checkinMap.filterPlace')"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs text-dx-muted">{{ t('checkinMap.filterDateStart') }}</label>
              <input
                v-model="filterDraft.timeStart"
                type="date"
                class="w-full rounded-lg border border-dx-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs text-dx-muted">{{ t('checkinMap.filterDateEnd') }}</label>
              <input
                v-model="filterDraft.timeEnd"
                type="date"
                class="w-full rounded-lg border border-dx-border px-3 py-2 text-sm"
              />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class="dx-btn-secondary !py-2" @click="resetFilters">
                {{ t('common.reset') }}
              </button>
              <button type="button" class="dx-btn-primary !py-2" @click="applyFilters">
                {{ t('common.search') }}
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-auto bg-dx-bg p-2">
            <div v-if="filteredList.length === 0" class="py-12 text-center text-sm text-dx-muted">
              {{ emptyDescription }}
            </div>
            <div v-else class="space-y-2">
              <article
                v-for="item in filteredList"
                :key="item.id"
                class="footprint-card"
                :class="{ active: selectedId === item.id }"
                @click="selectedId = item.id"
              >
                <div class="footprint-media">
                  <button
                    v-if="item.photos[0]"
                    type="button"
                    class="footprint-media-photo"
                    :style="{ backgroundImage: `url(${item.photos[0]})` }"
                    :aria-label="item.location.placeName || t('common.unknownPlace')"
                    @click.stop="openPhotoPreview(item.photos[0])"
                  />
                  <div
                    v-else
                    class="footprint-media-placeholder"
                    :style="getCheckInPlaceholderStyle(item)"
                    :aria-label="placeholderAriaLabel(item)"
                  >
                    <span class="footprint-media-letter">{{ getCheckInPlaceholderLabel(item) }}</span>
                  </div>
                </div>
                <div class="footprint-content">
                  <div class="footprint-head">
                    <h4 class="footprint-title">
                      {{ item.location.placeName || t('common.unknownPlace') }}
                    </h4>
                    <span class="footprint-points">
                      {{ t('checkinMap.pointsBadge', { points: item.pointsEarned }) }}
                    </span>
                  </div>
                  <p class="footprint-city">{{ item.city || item.cityCode || '-' }}</p>
                  <p class="footprint-time">{{ formatTime(item.checkedAt) }}</p>
                </div>
              </article>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <div
      v-if="photoPreviewSrc"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      @click="closePhotoPreview"
    >
      <img
        :src="photoPreviewSrc"
        alt=""
        class="max-h-[90vh] max-w-full rounded-lg shadow-lg"
        @click.stop
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { CheckInInfo } from '@douxing/shared';
import {
  CHECKIN_TIME_RANGE_OPTIONS,
  type CheckInTimeRange,
  filterCheckInsByTimeRange,
  filterCheckInsByMapQuery,
  findCityRegionByCode,
  getCityCodesInProvince,
  getCheckInsWithCoords,
  sumCheckInPoints,
  formatCheckInTime,
} from '@douxing/shared';
import { fetchAllCheckInsForMap } from '@/api/checkins';
import CheckInMap from '@/components/CheckInMap.vue';
import { useCityCascaderOptions } from '@/composables/useCityCascaderOptions';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';
import {
  getCheckInPlaceholderLabel,
  getCheckInPlaceholderStyle,
} from '@/utils/checkin-list-avatar';

const route = useRoute();
const { t, currentLocale } = useLocale();

function resolveInitialTimeRange(): CheckInTimeRange {
  const range = route.query.range;
  if (typeof range === 'string' && CHECKIN_TIME_RANGE_OPTIONS.some((opt) => opt.key === range)) {
    return range as CheckInTimeRange;
  }
  return 'all';
}

interface MapFilterState {
  cityPath: string[];
  placeName: string;
  timeStart?: string;
  timeEnd?: string;
}

function createEmptyFilter(): MapFilterState {
  return {
    cityPath: [],
    placeName: '',
    timeStart: undefined,
    timeEnd: undefined,
  };
}

const timeRangeOptions = computed(() =>
  CHECKIN_TIME_RANGE_OPTIONS.map((opt) => ({
    value: opt.key,
    label: t(opt.labelKey),
  })),
);

const allList = ref<CheckInInfo[]>([]);
const timeRange = ref<CheckInTimeRange>(resolveInitialTimeRange());
const filterDraft = ref<MapFilterState>(createEmptyFilter());
const appliedFilter = ref<MapFilterState>(createEmptyFilter());
const filterVisible = ref(false);
const checkInMapRef = ref<InstanceType<typeof CheckInMap> | null>(null);
const selectedId = ref<number | null>(null);
const loading = ref(false);
const error = ref('');
const photoPreviewSrc = ref('');

const cityOptions = useCityCascaderOptions(allList);

const provinceCode = computed({
  get: () => filterDraft.value.cityPath[0] ?? '',
  set: (value: string) => {
    filterDraft.value.cityPath = value ? [value] : [];
  },
});

const cityCode = computed({
  get: () => filterDraft.value.cityPath[1] ?? '',
  set: (value: string) => {
    const province = filterDraft.value.cityPath[0];
    if (!province) return;
    filterDraft.value.cityPath = value ? [province, value] : [province];
  },
});

const cityChildren = computed(() => {
  if (!provinceCode.value) return [];
  const province = cityOptions.value.find((item) => item.value === provinceCode.value);
  return province?.children ?? [];
});

const filteredList = computed(() => {
  const byRange = filterCheckInsByTimeRange(allList.value, timeRange.value);
  const cityPath = appliedFilter.value.cityPath;
  const provinceCodeFilter = cityPath.length === 1 ? cityPath[0] : undefined;
  const cityCodeFilter = cityPath.length > 1 ? cityPath[cityPath.length - 1] : undefined;
  const cityMeta = cityCodeFilter ? findCityRegionByCode(cityCodeFilter) : undefined;
  const cityName = cityMeta
    ? (currentLocale.value === 'en-US' ? cityMeta.nameEn : cityMeta.nameZh)
    : undefined;
  const provinceCityCodes = provinceCodeFilter
    ? getCityCodesInProvince(provinceCodeFilter)
    : [];

  return filterCheckInsByMapQuery(
    byRange,
    {
      provinceCode: provinceCodeFilter,
      cityCode: cityCodeFilter,
      cityName,
      placeName: appliedFilter.value.placeName,
      timeStart: appliedFilter.value.timeStart,
      timeEnd: appliedFilter.value.timeEnd,
    },
    provinceCityCodes,
  );
});

const hasActiveFilters = computed(() => {
  const filter = appliedFilter.value;
  return Boolean(
    filter.cityPath.length > 0
      || filter.placeName.trim()
      || filter.timeStart
      || filter.timeEnd,
  );
});

const emptyDescription = computed(() =>
  hasActiveFilters.value ? t('checkinMap.emptyFiltered') : t('checkinMap.empty'),
);

const totalPoints = computed(() => sumCheckInPoints(filteredList.value));
const hiddenCount = computed(
  () => filteredList.value.length - getCheckInsWithCoords(filteredList.value).length,
);

const statsLine = computed(() =>
  t('checkinMap.stats', { count: filteredList.value.length, points: totalPoints.value }),
);

const hiddenHint = computed(() =>
  hiddenCount.value > 0 ? t('checkinMap.hiddenNoCoords', { count: hiddenCount.value }) : '',
);

function formatTime(iso: string) {
  return formatCheckInTime(iso);
}

function placeholderAriaLabel(item: CheckInInfo) {
  const place = item.location.placeName || t('common.unknownPlace');
  return t('checkinMap.noPhotoFor', { place });
}

function openPhotoPreview(src: string) {
  photoPreviewSrc.value = src;
}

function closePhotoPreview() {
  photoPreviewSrc.value = '';
}

function applyFilters() {
  appliedFilter.value = {
    cityPath: [...filterDraft.value.cityPath],
    placeName: filterDraft.value.placeName,
    timeStart: filterDraft.value.timeStart || undefined,
    timeEnd: filterDraft.value.timeEnd || undefined,
  };
  selectedId.value = null;
}

function resetFilters() {
  filterDraft.value = createEmptyFilter();
  appliedFilter.value = createEmptyFilter();
  selectedId.value = null;
}

async function loadList() {
  loading.value = true;
  error.value = '';
  try {
    allList.value = await fetchAllCheckInsForMap(timeRange.value);
  } catch (e) {
    allList.value = [];
    error.value = getAppErrorMessage(e, t('common.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function resetMapView() {
  selectedId.value = null;
  nextTick(() => {
    checkInMapRef.value?.resetToChinaView();
  });
}

watch(timeRange, () => {
  selectedId.value = null;
  void loadList();
});

onMounted(loadList);
</script>

<style scoped>
.checkin-map-page {
  max-height: calc(100dvh - 4rem);
}

.map-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  grid-template-rows: minmax(0, 1fr);
  gap: 16px;
  min-height: 0;
}

.map-panel {
  min-height: 0;
}

.side-panel {
  min-height: 0;
  max-height: 100%;
}

.footprint-card {
  display: flex;
  align-items: stretch;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  cursor: pointer;
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease,
    border-color 0.2s ease;
}

.footprint-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--dx-primary) 10%, transparent);
  border-color: color-mix(in srgb, var(--dx-primary) 22%, transparent);
}

.footprint-card.active {
  border-color: var(--dx-primary);
  background: var(--dx-primary-light);
  box-shadow:
    0 0 0 1px var(--dx-primary),
    0 6px 16px color-mix(in srgb, var(--dx-primary) 14%, transparent);
}

.footprint-media {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 6px;
  overflow: hidden;
  background: #f3f4f6;
}

.footprint-media-photo {
  display: block;
  width: 64px;
  height: 64px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background-color: #f3f4f6;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  cursor: zoom-in;
}

.footprint-media-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.footprint-media-letter {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  color: rgba(255, 255, 255, 0.96);
  text-shadow: 0 1px 3px rgba(15, 23, 42, 0.16);
}

.footprint-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

.footprint-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
}

.footprint-title {
  margin: 0;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  color: #111827;
}

.footprint-card.active .footprint-title {
  color: var(--dx-primary);
}

.footprint-points {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--dx-primary-light);
  color: var(--dx-primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.footprint-city,
.footprint-time {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.35;
  color: #6b7280;
}

.footprint-time {
  font-size: 11px;
  color: #9ca3af;
}

@media (max-width: 960px) {
  .map-layout {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) minmax(0, 0.45fr);
  }
}
</style>
