<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>{{ t('checkinMap.title') }}</h2>
        <p class="desc">{{ t('checkinMap.desc') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn-secondary" @click="resetMapView">{{ t('checkinMap.nationalView') }}</button>
        <button class="btn-secondary" @click="loadList">{{ t('common.refresh') }}</button>
        <router-link class="btn-link" to="/checkins">{{ t('checkinMap.listLink') }}</router-link>
      </div>
    </div>

    <div class="toolbar">
      <div class="filters">
        <button
          v-for="opt in timeRangeOptions"
          :key="opt.key"
          class="filter-chip"
          :class="{ active: timeRange === opt.key }"
          @click="timeRange = opt.key"
        >
          {{ opt.label }}
        </button>
      </div>
      <p class="stats">
        {{ statsLine }}
        <span v-if="hiddenCount > 0" class="hint">{{ hiddenHint }}</span>
      </p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="layout">
      <div class="map-panel">
        <CheckInMap
          v-if="!loading"
          :items="filteredList"
          :selected-id="selectedId"
          @select="selectedId = $event"
        />
        <p v-else class="loading">{{ t('common.loading') }}</p>
      </div>

      <aside class="side-panel">
        <h3>{{ t('checkinMap.listTitle') }}</h3>
        <p v-if="filteredList.length === 0" class="empty">{{ t('checkinMap.empty') }}</p>
        <button
          v-for="item in filteredList"
          :key="item.id"
          class="timeline-item"
          :class="{ active: selectedId === item.id }"
          @click="selectedId = item.id"
        >
          <img
            v-if="item.photos[0]"
            :src="item.photos[0]"
            class="timeline-thumb"
            alt=""
          />
          <div class="timeline-body">
            <strong>{{ item.location.placeName || t('common.unknownPlace') }}</strong>
            <span>{{ userLine(item) }}</span>
            <span>{{ pointsCityLine(item) }}</span>
          </div>
        </button>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CheckInInfo } from '@douxing/shared';
import {
  CHECKIN_TIME_RANGE_OPTIONS,
  type CheckInTimeRange,
  filterCheckInsByTimeRange,
  getCheckInsWithCoords,
  sumCheckInPoints,
  formatCheckInTime,
} from '@douxing/shared';
import { fetchAllCheckInsForMap } from '@/api/checkins';
import CheckInMap from '@/components/CheckInMap.vue';

const { t } = useI18n();

const timeRangeOptions = computed(() =>
  CHECKIN_TIME_RANGE_OPTIONS.map((opt) => ({
    key: opt.key,
    label: t(opt.labelKey),
  })),
);
const allList = ref<CheckInInfo[]>([]);
const timeRange = ref<CheckInTimeRange>('all');
const selectedId = ref<number | null>(null);
const loading = ref(false);
const error = ref('');

const filteredList = computed(() => filterCheckInsByTimeRange(allList.value, timeRange.value));
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

function userLine(item: CheckInInfo) {
  return t('checkinMap.userLine', { userId: item.userId, time: formatTime(item.checkedAt) });
}

function pointsCityLine(item: CheckInInfo) {
  return t('checkinMap.pointsCity', {
    points: item.pointsEarned,
    city: item.city || item.cityCode || '-',
  });
}

async function loadList() {
  loading.value = true;
  error.value = '';
  try {
    allList.value = await fetchAllCheckInsForMap();
  } catch (e) {
    allList.value = [];
    error.value = e instanceof Error ? e.message : t('common.loadFailed');
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
.page {
  max-width: none;
  width: 100%;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}
.desc {
  color: #6b7280;
  margin-top: 8px;
}
.head-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
.btn-secondary {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}
.btn-link {
  color: #1677ff;
  text-decoration: none;
  font-size: 14px;
}
.toolbar {
  margin-bottom: 16px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.filter-chip {
  padding: 6px 14px;
  border: none;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  cursor: pointer;
  font-size: 13px;
}
.filter-chip.active {
  background: #1677ff;
  color: #fff;
}
.stats {
  margin-top: 10px;
  font-size: 14px;
  color: #374151;
}
.hint {
  color: #9ca3af;
}
.error {
  color: #dc2626;
  margin-bottom: 12px;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  min-height: calc(100vh - 220px);
}
.map-panel {
  min-height: calc(100vh - 240px);
  height: calc(100vh - 240px);
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 8px;
  display: flex;
  flex-direction: column;
}
.side-panel {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 16px;
  max-height: calc(100vh - 240px);
  overflow: auto;
}
.side-panel h3 {
  margin: 0 0 12px;
  font-size: 16px;
}
.timeline-item {
  display: flex;
  gap: 10px;
  width: 100%;
  padding: 10px;
  margin-bottom: 8px;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}
.timeline-item.active {
  border-color: #1677ff;
  background: #f0f7ff;
}
.timeline-thumb {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}
.timeline-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
}
.timeline-body strong {
  font-size: 14px;
  color: #111827;
}
.empty,
.loading {
  color: #9ca3af;
}
@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .side-panel {
    max-height: none;
  }
}
</style>
