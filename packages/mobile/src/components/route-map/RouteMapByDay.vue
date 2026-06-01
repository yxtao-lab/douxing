<template>
  <view class="route-map-by-day">
    <scroll-view
      v-if="showDayTabs && days.length > 1"
      class="day-tabs"
      scroll-x
      enable-flex
      :show-scrollbar="false"
    >
      <view
        v-for="(day, index) in days"
        :key="index"
        class="day-tab"
        :class="{ active: index === resolvedActiveDayIndex, loading: isDayLoading(index) }"
        @click="setActiveDayIndex(index)"
      >
        <text>{{ dayTabLabel(day, index) }}</text>
      </view>
    </scroll-view>

    <text v-if="showDayTabs && activeDayHeading" class="day-heading">{{ activeDayHeading }}</text>

    <view v-if="dayLoadError" class="day-error">
      <text>{{ dayLoadError }}</text>
    </view>

    <RouteMapPlayer
      v-if="activeRoutePath"
      :key="`route-map-day-${resolvedActiveDayIndex}`"
      :route-path="activeRoutePath"
      :auto-play="autoPlay"
      :duration-ms="durationMs"
    />

    <view v-else-if="loadingActiveDay" class="map-loading">
      <text>{{ t('routeMap.loadingDay') }}</text>
    </view>

    <view v-else class="map-empty">
      <text>{{ t('routeMap.dayPathEmpty') }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { RouteDayPlan, RoutePath } from '@douxing/shared';
import { buildRoutePathForDay } from '@douxing/shared';
import { fetchRouteMapPath } from '@/api/routes';
import { getAppErrorMessage } from '@/utils/request';
import RouteMapPlayer from '@/components/route-map/RouteMapPlayer.vue';
import { useTf } from '@/i18n/useTf';

const props = withDefaults(
  defineProps<{
    routeId: number;
    days: RouteDayPlan[];
    routeDetail: Record<string, unknown> | null;
    routeName?: string;
    autoPlay?: boolean;
    durationMs?: number;
    activeDayIndex?: number;
    showDayTabs?: boolean;
  }>(),
  {
    routeName: '',
    autoPlay: true,
    durationMs: 6000,
    activeDayIndex: undefined,
    showDayTabs: true,
  },
);

const emit = defineEmits<{
  'update:activeDayIndex': [index: number];
}>();

const { t, tf } = useTf();

const internalActiveDayIndex = ref(0);
const pathByDay = ref<Record<number, RoutePath | null>>({});
const loadingDays = ref<Record<number, boolean>>({});
const dayLoadError = ref('');

const resolvedActiveDayIndex = computed(() =>
  props.activeDayIndex !== undefined ? props.activeDayIndex : internalActiveDayIndex.value,
);

const activeRoutePath = computed(() => pathByDay.value[resolvedActiveDayIndex.value] ?? null);

const loadingActiveDay = computed(() => loadingDays.value[resolvedActiveDayIndex.value] === true);

const activeDay = computed(() => props.days[resolvedActiveDayIndex.value]);

const activeDayHeading = computed(() => {
  if (!activeDay.value || props.days.length <= 1) return '';
  const day = activeDay.value;
  if (day.date && day.title) {
    return tf('routes.dayTitle', { date: day.date, title: day.title });
  }
  return day.title || day.date || '';
});

watch(
  () => props.days.length,
  () => {
    if (resolvedActiveDayIndex.value >= props.days.length) {
      setActiveDayIndex(0, { skipLoad: true });
    }
  },
);

function setActiveDayIndex(index: number, options?: { skipLoad?: boolean }) {
  if (index < 0 || index >= props.days.length) return;
  if (index === resolvedActiveDayIndex.value && !options?.skipLoad) {
    void ensureDayPath(index);
    return;
  }

  if (props.activeDayIndex !== undefined) {
    emit('update:activeDayIndex', index);
  } else {
    internalActiveDayIndex.value = index;
  }

  if (!options?.skipLoad) {
    void ensureDayPath(index);
    prefetchDay(index + 1);
  }
}

function dayTabLabel(day: RouteDayPlan, index: number): string {
  if (day.date?.trim()) return day.date;
  return tf('routes.flowDayTab', { day: index + 1 });
}

function isDayLoading(index: number): boolean {
  return loadingDays.value[index] === true && !pathByDay.value[index];
}

function buildLocalDayPath(dayIndex: number): RoutePath | null {
  return buildRoutePathForDay(props.routeDetail, dayIndex, {
    routeId: props.routeId,
    name: props.routeName,
  });
}

function setDayLoading(dayIndex: number, loading: boolean) {
  loadingDays.value = { ...loadingDays.value, [dayIndex]: loading };
}

async function ensureDayPath(dayIndex: number, options?: { force?: boolean }) {
  if (dayIndex < 0 || dayIndex >= props.days.length) return;
  if (!options?.force && pathByDay.value[dayIndex] != null) return;

  dayLoadError.value = '';
  const localPath = buildLocalDayPath(dayIndex);
  if (localPath) {
    pathByDay.value = { ...pathByDay.value, [dayIndex]: localPath };
  }

  setDayLoading(dayIndex, true);
  try {
    const serverPath = await fetchRouteMapPath(props.routeId, dayIndex);
    pathByDay.value = { ...pathByDay.value, [dayIndex]: serverPath };
  } catch (e) {
    if (!localPath) {
      dayLoadError.value = getAppErrorMessage(e, t('routeMap.dayPathLoadFailed'));
      pathByDay.value = { ...pathByDay.value, [dayIndex]: null };
    }
  } finally {
    setDayLoading(dayIndex, false);
  }
}

function prefetchDay(dayIndex: number) {
  if (dayIndex < 0 || dayIndex >= props.days.length) return;
  if (pathByDay.value[dayIndex] != null || loadingDays.value[dayIndex]) return;
  void ensureDayPath(dayIndex);
}

function resetAndLoadDays() {
  pathByDay.value = {};
  loadingDays.value = {};
  dayLoadError.value = '';
  setActiveDayIndex(0, { skipLoad: true });
  void ensureDayPath(0);
  if (props.days.length > 1) {
    prefetchDay(1);
  }
}

watch(
  () => resolvedActiveDayIndex.value,
  (index) => {
    void ensureDayPath(index);
    prefetchDay(index + 1);
  },
);

watch(
  () => [props.routeId, props.days] as const,
  () => {
    resetAndLoadDays();
  },
  { deep: true, immediate: true },
);
</script>

<style scoped>
.route-map-by-day {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.day-tabs {
  display: flex;
  flex-direction: row;
  white-space: nowrap;
  margin-bottom: 4rpx;
}

.day-tab {
  display: inline-flex;
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  margin-right: 12rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  font-size: 24rpx;
  color: #6b7280;
}

.day-tab.active {
  background: #e8f3ff;
  color: #1677ff;
  font-weight: 600;
}

.day-tab.loading {
  opacity: 0.75;
}

.day-heading {
  font-size: 26rpx;
  color: #374151;
  font-weight: 500;
}

.day-error {
  padding: 12rpx 16rpx;
  background: #fef2f2;
  border-radius: 8rpx;
  font-size: 22rpx;
  color: #b91c1c;
}

.map-loading,
.map-empty {
  height: 420rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #9ca3af;
}
</style>
