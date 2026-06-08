<template>
  <div v-if="days.length > 1" class="flex gap-2 overflow-x-auto pb-1">
    <button
      v-for="(day, index) in days"
      :key="index"
      type="button"
      class="shrink-0 rounded-full px-4 py-1.5 text-sm transition"
      :class="
        index === activeDayIndex
          ? 'bg-dx-primary-light font-medium text-dx-primary'
          : 'bg-gray-100 text-dx-muted hover:bg-gray-200'
      "
      @click="selectDay(index)"
    >
      {{ dayTabLabel(day, index) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { RouteDayPlan } from '@douxing/shared';
import { useLocale } from '@/i18n/useLocale';

defineProps<{
  days: RouteDayPlan[];
  activeDayIndex: number;
}>();

const emit = defineEmits<{
  'update:activeDayIndex': [index: number];
}>();

const { t } = useLocale();

function dayTabLabel(day: RouteDayPlan, index: number): string {
  if (day.date?.trim()) return day.date;
  return t('routes.flowDayTab', { day: index + 1 });
}

function selectDay(index: number) {
  emit('update:activeDayIndex', index);
}
</script>
