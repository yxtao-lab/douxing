<template>
  <SubPageShell
    :title="t('nav.checkins')"
    :description="t('emptyState.checkinsDesc')"
    :back-to="{ name: 'profile' }"
    :back-label="t('pc.nav.profile')"
  >
    <template #actions>
      <RouterLink
        :to="{ name: 'checkins-map', query: { range: timeRange } }"
        class="text-sm text-dx-primary hover:underline"
      >
        {{ t('checkins.mapLink') }}
      </RouterLink>
    </template>
    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="opt in rangeOptions"
        :key="opt.key"
        type="button"
        class="rounded-full px-3 py-1 text-xs"
        :class="timeRange === opt.key ? 'bg-dx-primary text-white' : 'bg-gray-100 text-dx-muted'"
        @click="switchRange(opt.key)"
      >
        {{ opt.label }}
      </button>
    </div>

    <div v-if="loading && items.length === 0" class="dx-card text-center text-dx-muted">
      {{ t('common.loading') }}
    </div>
    <div v-else-if="items.length === 0" class="dx-card text-center">
      <p class="mb-4 text-dx-muted">{{ t('checkins.listEmpty') }}</p>
      <RouterLink :to="{ name: 'plan' }" class="dx-btn-primary">{{ t('routes.goPlan') }}</RouterLink>
    </div>
    <div v-else class="space-y-3">
      <div v-for="item in items" :key="item.id" class="dx-card">
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-semibold text-dx-text">{{ item.location.placeName }}</h3>
          <span class="shrink-0 text-sm font-medium text-dx-primary">
            {{ t('checkins.pointsEarned', { points: item.pointsEarned }) }}
          </span>
        </div>
        <p v-if="item.city || item.cityCode" class="mt-1 text-sm text-dx-muted">{{ item.city || item.cityCode }}</p>
        <p class="mt-1 text-xs text-dx-muted">{{ formatTime(item.checkedAt) }}</p>
        <p v-if="item.remark" class="mt-2 text-sm text-dx-muted">{{ item.remark }}</p>
        <div v-if="item.photos.length" class="mt-3 flex flex-wrap gap-2">
          <img
            v-for="(photo, idx) in item.photos"
            :key="idx"
            :src="photo"
            alt=""
            class="h-16 w-16 rounded-lg object-cover"
          />
        </div>
      </div>
      <InfiniteScrollFooter
        :has-more="hasMore"
        :loading="loading"
        :loading-more="loadingMore"
        :on-load-more="loadMore"
      />
    </div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CheckInInfo, CheckInTimeRange } from '@douxing/shared';
import { formatDisplayDateTime } from '@douxing/shared';
import { fetchCheckInsPage } from '@/api/checkins';
import InfiniteScrollFooter from '@/components/InfiniteScrollFooter.vue';
import SubPageShell from '@/components/SubPageShell.vue';
import { useLocale } from '@/i18n/useLocale';

const { t } = useLocale();
const timeRange = ref<CheckInTimeRange>('all');
const items = ref<CheckInInfo[]>([]);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);
const loading = ref(false);
const loadingMore = ref(false);

const rangeOptions = computed(() => [
  { key: 'all' as CheckInTimeRange, label: t('checkins.rangeAll') },
  { key: '7d' as CheckInTimeRange, label: t('checkins.range7d') },
  { key: '30d' as CheckInTimeRange, label: t('checkins.range30d') },
  { key: '90d' as CheckInTimeRange, label: t('checkins.range90d') },
]);

function formatTime(iso: string) {
  return formatDisplayDateTime(iso) || iso;
}

async function fetchPage(nextPage: number, append: boolean) {
  const result = await fetchCheckInsPage({ page: nextPage, pageSize, range: timeRange.value });
  items.value = append ? [...items.value, ...result.items] : result.items;
  page.value = nextPage;
  hasMore.value = result.hasMore;
}

async function reload() {
  loading.value = true;
  try {
    await fetchPage(1, false);
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value || loading.value) return;
  loadingMore.value = true;
  try {
    await fetchPage(page.value + 1, true);
  } finally {
    loadingMore.value = false;
  }
}

function switchRange(range: CheckInTimeRange) {
  timeRange.value = range;
}

watch(timeRange, () => {
  void reload();
}, { immediate: true });
</script>
