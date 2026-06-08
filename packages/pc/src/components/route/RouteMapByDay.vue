<template>
  <div class="w-full">
    <p v-if="showDayTabs && activeDayHeading" class="mb-3 text-sm font-medium text-dx-text">
      {{ activeDayHeading }}
    </p>

    <p v-if="dayLoadError" class="mb-3 text-sm text-red-600">{{ dayLoadError }}</p>

    <RouteMapPlayer
      v-if="activeRoutePath"
      :key="`route-map-day-${resolvedActiveDayIndex}`"
      :route-path="activeRoutePath"
      :auto-play="autoPlay"
      :duration-ms="durationMs"
    />

    <div v-else-if="loadingActiveDay" class="rounded-xl border border-dx-border bg-white py-12 text-center text-sm text-dx-muted">
      {{ t('routeMap.loadingDay') }}
    </div>

    <div v-else class="rounded-xl border border-dx-border bg-white py-12 text-center text-sm text-dx-muted">
      {{ t('routeMap.dayPathEmpty') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { RouteDayPlan, RoutePath } from '@douxing/shared';
import { buildRoutePathForDay } from '@douxing/shared';
import { fetchRouteMapPath } from '@/api/routes';
import RouteMapPlayer from '@/components/route/RouteMapPlayer.vue';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';

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

const { t } = useLocale();

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
    return t('routes.dayTitle', { date: day.date, title: day.title });
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

watch(
  () => [props.routeId, props.days.length] as const,
  () => {
    pathByDay.value = {};
    loadingDays.value = {};
    void ensureDayPath(resolvedActiveDayIndex.value);
  },
  { immediate: true },
);

watch(resolvedActiveDayIndex, (index) => {
  void ensureDayPath(index);
  prefetchDay(index + 1);
});

function setActiveDayIndex(index: number, options?: { skipLoad?: boolean }) {
  if (index < 0 || index >= props.days.length) return;
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

function buildLocalDayPath(dayIndex: number): RoutePath | null {
  return buildRoutePathForDay(props.routeDetail, dayIndex, {
    routeId: props.routeId,
    name: props.routeName,
  });
}

function setDayLoading(dayIndex: number, loading: boolean) {
  loadingDays.value = { ...loadingDays.value, [dayIndex]: loading };
}

function setDayPath(dayIndex: number, path: RoutePath | null) {
  pathByDay.value = { ...pathByDay.value, [dayIndex]: path };
}

async function ensureDayPath(dayIndex: number) {
  if (dayIndex < 0 || dayIndex >= props.days.length) return;
  if (pathByDay.value[dayIndex] !== undefined) return;

  setDayLoading(dayIndex, true);
  dayLoadError.value = '';

  try {
    const serverPath = await fetchRouteMapPath(props.routeId, dayIndex);
    if (serverPath?.fullPoints?.length >= 2) {
      setDayPath(dayIndex, serverPath);
      return;
    }
  } catch (err) {
    dayLoadError.value = getAppErrorMessage(err, t('routeMap.dayPathLoadFailed'));
  } finally {
    setDayLoading(dayIndex, false);
  }

  setDayPath(dayIndex, buildLocalDayPath(dayIndex));
}

function prefetchDay(dayIndex: number) {
  if (dayIndex >= props.days.length) return;
  if (pathByDay.value[dayIndex] !== undefined) return;
  void ensureDayPath(dayIndex);
}
</script>
