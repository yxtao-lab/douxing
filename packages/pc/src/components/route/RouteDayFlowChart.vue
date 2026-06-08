<template>
  <div class="w-full">
    <div v-if="showTitle" class="mb-4">
      <h3 class="text-base font-semibold text-dx-text">{{ t('routes.flowChartTitle') }}</h3>
    </div>

    <RouteDayTabs
      v-if="showDayTabs && days.length > 1"
      :days="days"
      :active-day-index="resolvedActiveDayIndex"
      @update:active-day-index="setActiveDayIndex"
    />

    <div v-if="activeDay" class="mt-4">
      <p v-if="days.length === 1" class="mb-4 text-base font-semibold text-dx-text">
        {{ dayHeading(activeDay) }}
      </p>

      <p v-if="flowNodes.length === 0" class="py-4 text-sm text-dx-muted">
        {{ t('routes.flowChartEmpty') }}
      </p>

      <div
        v-if="activeWarnings.length"
        class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
      >
        <p class="mb-1 text-sm font-medium text-amber-900">{{ t('routes.flowWarningsTitle') }}</p>
        <p
          v-for="(warn, wi) in activeWarnings"
          :key="`warn-${wi}`"
          class="text-sm text-amber-800"
        >
          {{ warn }}
        </p>
      </div>

      <div v-if="flowNodes.length > 0" class="space-y-0">
        <div
          v-for="(node, index) in flowNodes"
          :key="`${node.kind}-${index}`"
          class="flex gap-3"
        >
          <div class="flex flex-col items-center">
            <div
              class="h-3 w-3 shrink-0 rounded-full ring-4 ring-white"
              :class="dotClass(node.kind)"
            />
            <div
              v-if="index < flowNodes.length - 1"
              class="my-1 w-0.5 flex-1 bg-dx-border"
            />
          </div>

          <div
            class="mb-4 flex-1 rounded-xl border p-4"
            :class="cardClass(node.kind)"
          >
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <span class="text-xs font-medium uppercase tracking-wide text-dx-muted">
                {{ kindLabel(node.kind) }}
              </span>
              <span
                v-if="node.intercity"
                class="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
              >
                {{ t('routes.flowIntercity') }}
              </span>
              <span
                v-if="node.estimated"
                class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
              >
                {{ t('routes.transitEstimated') }}
              </span>
            </div>

            <div class="flex gap-3">
              <button
                v-if="node.kind === 'play' && node.spot?.coverImageUrl"
                type="button"
                class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-dx-border"
                :title="t('routes.coverImagePreview')"
                @click="previewCoverImage(node.spot.coverImageUrl)"
              >
                <img
                  :src="node.spot.coverImageUrl"
                  :alt="node.title"
                  class="h-full w-full object-cover"
                />
              </button>
              <div class="min-w-0 flex-1">
                <p class="font-medium text-dx-text">{{ node.title }}</p>
                <p v-if="node.subtitle" class="mt-0.5 text-sm text-dx-primary">{{ node.subtitle }}</p>
                <p v-if="nodeMeta(node)" class="mt-1 text-xs text-dx-muted">{{ nodeMeta(node) }}</p>
                <p v-if="node.description" class="mt-2 text-sm leading-relaxed text-dx-muted">
                  {{ node.description }}
                </p>
                <a
                  v-if="node.transit?.bookingUrl"
                  :href="node.transit.bookingUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mt-2 inline-block text-sm text-dx-primary hover:underline"
                >
                  {{ bookingLinkLabel(node.transit) }}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { RouteDayPlan, RouteTransitSegment } from '@douxing/shared';
import RouteDayTabs from '@/components/route/RouteDayTabs.vue';
import { useLocale } from '@/i18n/useLocale';
import {
  buildRouteDayFlow,
  type RouteFlowNode,
  type RouteFlowNodeKind,
} from '@/utils/route-day-flow';

const props = withDefaults(
  defineProps<{
    days: RouteDayPlan[];
    showTitle?: boolean;
    initialDayIndex?: number;
    activeDayIndex?: number;
    showDayTabs?: boolean;
  }>(),
  {
    showTitle: true,
    initialDayIndex: 0,
    activeDayIndex: undefined,
    showDayTabs: true,
  },
);

const emit = defineEmits<{
  'update:activeDayIndex': [index: number];
}>();

const { t } = useLocale();

const internalActiveDayIndex = ref(props.initialDayIndex);

const resolvedActiveDayIndex = computed(() =>
  props.activeDayIndex !== undefined ? props.activeDayIndex : internalActiveDayIndex.value,
);

function setActiveDayIndex(index: number) {
  if (index < 0 || index >= props.days.length) return;
  if (props.activeDayIndex !== undefined) {
    emit('update:activeDayIndex', index);
    return;
  }
  internalActiveDayIndex.value = index;
}

watch(
  () => props.days.length,
  () => {
    if (resolvedActiveDayIndex.value >= props.days.length) {
      setActiveDayIndex(0);
    }
  },
);

const activeDay = computed(() => props.days[resolvedActiveDayIndex.value]);

const flowNodes = computed((): RouteFlowNode[] => {
  if (!activeDay.value) return [];
  return buildRouteDayFlow(activeDay.value);
});

const activeWarnings = computed(() => activeDay.value?.warnings ?? []);

function dayHeading(day: RouteDayPlan): string {
  if (day.date && day.title) return t('routes.dayTitle', { date: day.date, title: day.title });
  return day.title || day.date || '';
}

function kindLabel(kind: RouteFlowNodeKind): string {
  if (kind === 'transit') return t('routes.sectionTransit');
  if (kind === 'play') return t('routes.sectionPlay');
  return t('routes.sectionLodging');
}

function dotClass(kind: RouteFlowNodeKind): string {
  if (kind === 'transit') return 'bg-blue-500';
  if (kind === 'play') return 'bg-dx-primary';
  return 'bg-emerald-500';
}

function cardClass(kind: RouteFlowNodeKind): string {
  if (kind === 'transit') return 'border-blue-100 bg-blue-50/40';
  if (kind === 'play') return 'border-dx-border bg-white';
  return 'border-emerald-100 bg-emerald-50/40';
}

function nodeMeta(node: RouteFlowNode): string {
  if (node.kind === 'transit' && node.transit) {
    const modeKey = `routes.transitMode_${node.transit.mode}` as const;
    const modeLabel = t(modeKey);
    const mode = modeLabel === modeKey ? node.transit.mode : modeLabel;
    const duration = t('routes.transitDuration', { minutes: node.transit.durationMinutes });
    if (node.transit.scheduleNo) {
      const schedule = t('routes.transitScheduleNo', { no: node.transit.scheduleNo });
      return `${schedule} · ${mode} · ${duration}`;
    }
    return `${mode} · ${duration}`;
  }
  if (node.meta != null && node.meta !== '') {
    return `¥${node.meta}`;
  }
  return '';
}

function bookingLinkLabel(seg: RouteTransitSegment): string {
  if (seg.scheduleSource === 'catalog' || seg.scheduleSource === 'api') {
    return t('routes.transitBookReal');
  }
  return t('routes.transitBookDemo');
}

function previewCoverImage(url: string) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}
</script>
