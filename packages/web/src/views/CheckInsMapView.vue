<template>
  <PageContainer :title="t('checkinMap.title')" :description="t('checkinMap.desc')">
    <template #extra>
      <a-space>
        <a-button @click="resetMapView">{{ t('checkinMap.nationalView') }}</a-button>
        <a-button @click="loadList">{{ t('common.refresh') }}</a-button>
        <router-link to="/checkins">
          <a-button type="link">{{ t('checkinMap.listLink') }}</a-button>
        </router-link>
      </a-space>
    </template>

    <div class="map-page">
      <div class="toolbar">
        <a-segmented v-model:value="timeRange" :options="timeRangeOptions" />
        <p class="stats">
          {{ statsLine }}
          <span v-if="hiddenCount > 0" class="hint">{{ hiddenHint }}</span>
        </p>
      </div>

      <a-alert v-if="error" type="error" :message="error" show-icon />

      <div ref="mapLayoutRef" class="map-layout">
        <a-card class="map-panel" :body-style="mapPanelBodyStyle">
          <a-spin :spinning="loading">
            <CheckInMap
              :height="mapHeight"
              :items="filteredList"
              :selected-id="selectedId"
              @select="selectedId = $event"
            />
          </a-spin>
        </a-card>

        <a-card class="side-panel" :title="t('checkinMap.listTitle')">
          <template #extra>
            <a-button type="link" size="small" class="filter-toggle" @click="filterVisible = !filterVisible">
              <DownOutlined v-if="!filterVisible" class="filter-toggle-icon" aria-hidden="true" />
              <UpOutlined v-else class="filter-toggle-icon" aria-hidden="true" />
              {{ filterVisible ? t('checkinMap.hideFilter') : t('checkinMap.showFilter') }}
            </a-button>
          </template>
          <div class="side-panel-body">
            <section v-show="filterVisible" class="side-filters">
              <div class="filter-field">
                <label class="filter-label">{{ t('checkinMap.filterCity') }}</label>
                <a-cascader
                  v-model:value="filterDraft.cityPath"
                  :options="cityOptions"
                  :placeholder="t('checkinMap.filterCity')"
                  allow-clear
                  show-search
                  style="width: 100%"
                />
              </div>

              <div class="filter-field">
                <label class="filter-label">{{ t('checkinMap.filterPlace') }}</label>
                <a-input
                  v-model:value="filterDraft.placeName"
                  allow-clear
                  :placeholder="t('checkinMap.filterPlace')"
                />
              </div>

              <div class="filter-field">
                <label class="filter-label">{{ t('checkinMap.filterDateStart') }}</label>
                <a-date-picker
                  v-model:value="filterDraft.timeStart"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  allow-clear
                  style="width: 100%"
                  :placeholder="t('checkinMap.filterDateStart')"
                />
              </div>

              <div class="filter-field">
                <label class="filter-label">{{ t('checkinMap.filterDateEnd') }}</label>
                <a-date-picker
                  v-model:value="filterDraft.timeEnd"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  allow-clear
                  style="width: 100%"
                  :placeholder="t('checkinMap.filterDateEnd')"
                />
              </div>

              <div class="filter-actions">
                <a-button block @click="resetFilters">{{ t('common.reset') }}</a-button>
                <a-button block type="primary" @click="applyFilters">{{ t('common.search') }}</a-button>
              </div>
            </section>

            <section class="footprint-list-wrap">
              <a-empty v-if="filteredList.length === 0" :description="emptyDescription" />
              <div v-else class="footprint-list">
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
                    <p class="footprint-city">
                      <EnvironmentOutlined class="footprint-meta-icon" aria-hidden="true" />
                      <span>{{ item.city || item.cityCode || '-' }}</span>
                    </p>
                    <div class="footprint-meta">
                      <span class="footprint-meta-item">
                        <UserOutlined class="footprint-meta-icon" aria-hidden="true" />
                        {{ t('checkinMap.userId', { userId: item.userId }) }}
                      </span>
                      <span class="footprint-meta-dot" aria-hidden="true">·</span>
                      <span class="footprint-meta-item footprint-meta-time">
                        <ClockCircleOutlined class="footprint-meta-icon" aria-hidden="true" />
                        {{ formatTime(item.checkedAt) }}
                      </span>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </a-card>
      </div>
    </div>

    <a-image
      v-if="photoPreviewSrc"
      :src="photoPreviewSrc"
      :preview="photoPreviewOptions"
      class="footprint-photo-preview-anchor"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onMounted } from 'vue';
import { ClockCircleOutlined, DownOutlined, EnvironmentOutlined, UpOutlined, UserOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { CheckInInfo } from '@douxing/shared';
import {
  CHECKIN_TIME_RANGE_OPTIONS,
  type CheckInTimeRange,
  filterCheckInsByTimeRange,
  filterCheckInsByMapQuery,
  findCityRegionByCode,
  getCityCodesInProvince,
  getCheckInsWithCoords,
  resolveCityFilterFromPath,
  sumCheckInPoints,
  formatCheckInTime,
} from '@douxing/shared';
import { fetchAllCheckInsForMap } from '@/api/checkins';
import { getAppErrorMessage } from '@/utils/error-message';
import {
  getCheckInPlaceholderLabel,
  getCheckInPlaceholderStyle,
} from '@/utils/checkin-list-avatar';
import CheckInMap from '@/components/CheckInMap.vue';
import { useElementHeight } from '@/composables/useElementHeight';
import { useCityCascaderOptions } from '@/composables/useCityCascaderOptions';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.checkinMap');

const { t, locale } = useI18n();
const { elementRef: mapLayoutRef, height: mapLayoutHeight } = useElementHeight();

const MAP_CARD_BODY_PADDING = 16;

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
const timeRange = ref<CheckInTimeRange>('all');
const filterDraft = ref<MapFilterState>(createEmptyFilter());
const appliedFilter = ref<MapFilterState>(createEmptyFilter());
const filterVisible = ref(false);
const selectedId = ref<number | null>(null);
const loading = ref(false);
const error = ref('');
const photoPreviewSrc = ref('');
const photoPreviewVisible = ref(false);

const cityOptions = useCityCascaderOptions(allList);

const photoPreviewOptions = computed(() => ({
  visible: photoPreviewVisible.value,
  onVisibleChange: (visible: boolean) => {
    photoPreviewVisible.value = visible;
    if (!visible) {
      photoPreviewSrc.value = '';
    }
  },
}));

const filteredList = computed(() => {
  const byRange = filterCheckInsByTimeRange(allList.value, timeRange.value);
  const cityFilter = resolveCityFilterFromPath(appliedFilter.value.cityPath);
  const cityMeta = cityFilter.cityCode ? findCityRegionByCode(cityFilter.cityCode) : undefined;
  const cityName = cityMeta
    ? (locale.value === 'en-US' ? cityMeta.nameEn : cityMeta.nameZh)
    : undefined;
  const provinceCityCodes = cityFilter.provinceCode
    ? getCityCodesInProvince(cityFilter.provinceCode)
    : [];

  return filterCheckInsByMapQuery(
    byRange,
    {
      provinceCode: cityFilter.provinceCode,
      cityCode: cityFilter.cityCode,
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

const mapPanelBodyStyle = {
  padding: '8px',
} as const;

const mapHeight = computed(() =>
  Math.max(320, mapLayoutHeight.value - MAP_CARD_BODY_PADDING),
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
  photoPreviewVisible.value = true;
}

function applyFilters() {
  appliedFilter.value = {
    cityPath: [...filterDraft.value.cityPath],
    placeName: filterDraft.value.placeName,
    timeStart: filterDraft.value.timeStart,
    timeEnd: filterDraft.value.timeEnd,
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
    allList.value = await fetchAllCheckInsForMap();
  } catch (e) {
    allList.value = [];
    error.value = getAppErrorMessage(e, t('common.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function resetMapView() {
  selectedId.value = null;
}

watch(timeRange, () => {
  selectedId.value = null;
});

onMounted(loadList);
</script>

<style scoped>
.map-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

.stats {
  margin: 0;
  font-size: 14px;
  color: #374151;
}

.hint {
  color: #9ca3af;
}

.map-layout {
  flex: 1 1 0;
  min-height: 320px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  grid-template-rows: 1fr;
  gap: 16px;
}

.map-panel,
.side-panel {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.side-panel {
  display: flex;
  flex-direction: column;
}

.side-panel :deep(.ant-card-head) {
  min-height: auto;
  padding: 10px 8px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.side-panel :deep(.ant-card-head-wrapper) {
  align-items: center;
}

.side-panel :deep(.ant-card-head-title) {
  padding: 0;
  font-size: 14px;
  font-weight: 600;
}

.side-panel :deep(.ant-card-extra) {
  padding: 0;
}

.side-panel :deep(.ant-card-body) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0;
  background: #eef1f6;
}

.side-panel-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  height: auto;
  font-size: 13px;
}

.filter-toggle-icon {
  font-size: 11px;
}

.side-filters {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px;
  background: #fff;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-label {
  font-size: 12px;
  line-height: 1.4;
  color: #6b7280;
}

.filter-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 2px;
}

.footprint-list-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
}

.footprint-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footprint-card {
  display: flex;
  align-items: stretch;
  gap: 10px;
  padding: 8px;
  overflow: hidden;
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
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.1);
  border-color: rgba(22, 119, 255, 0.22);
}

.footprint-card.active {
  border-color: #1677ff;
  background: #f8fbff;
  box-shadow:
    0 0 0 1px #1677ff,
    0 6px 16px rgba(22, 119, 255, 0.14);
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
  flex-shrink: 0;
}

.footprint-photo-preview-anchor {
  position: fixed;
  width: 0;
  height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
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
  color: #1677ff;
}

.footprint-points {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1677ff;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.footprint-card.active .footprint-points {
  background: #dbeafe;
}

.footprint-city {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.35;
  color: #6b7280;
}

.footprint-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.footprint-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.35;
  color: #9ca3af;
  min-width: 0;
}

.footprint-meta-time {
  flex-shrink: 0;
}

.footprint-meta-dot {
  flex-shrink: 0;
  color: #d1d5db;
  font-size: 11px;
}

.footprint-meta-icon {
  flex-shrink: 0;
  font-size: 11px;
  color: #c4c9d2;
}

@media (max-width: 960px) {
  .map-layout {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .map-panel,
  .side-panel {
    min-height: 420px;
    height: 420px;
  }
}
</style>
