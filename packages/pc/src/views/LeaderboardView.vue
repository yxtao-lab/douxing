<template>
  <SubPageShell
    :title="t('nav.leaderboard')"
    :description="t('emptyState.leaderboardDesc')"
    :back-to="{ name: 'profile' }"
    :back-label="t('pc.nav.profile')"
  >
    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="opt in periodOptions"
        :key="opt.key"
        type="button"
        class="rounded-full px-3 py-1 text-xs"
        :class="period === opt.key ? 'bg-dx-primary text-white' : 'bg-gray-100 text-dx-muted'"
        @click="period = opt.key"
      >
        {{ opt.label }}
      </button>
    </div>
    <div class="mb-6 flex flex-wrap gap-2">
      <button
        v-for="opt in metricOptions"
        :key="opt.key"
        type="button"
        class="rounded-full px-3 py-1 text-xs"
        :class="metric === opt.key ? 'bg-dx-primary-light text-dx-primary' : 'bg-gray-100 text-dx-muted'"
        @click="metric = opt.key"
      >
        {{ opt.label }}
      </button>
    </div>

    <div v-if="summary" class="mb-4 rounded-xl bg-dx-primary-light px-4 py-3 text-sm">
      <p>{{ periodLabel }} · {{ metricLabel }}</p>
      <p class="font-medium text-dx-primary">
        {{ summary.myRank != null ? t('leaderboard.myRank', { rank: summary.myRank }) : t('leaderboard.myRankEmpty') }}
      </p>
    </div>

    <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('common.loading') }}</div>
    <div v-else-if="entries.length === 0" class="dx-card text-center text-dx-muted">{{ t('leaderboard.empty') }}</div>
    <div v-else class="space-y-2">
      <div
        v-for="item in entries"
        :key="item.userId"
        class="flex items-center gap-3 rounded-xl border border-dx-border bg-white px-4 py-3"
        :class="{ 'border-dx-primary bg-dx-primary-light/30': item.isMe }"
      >
        <span class="w-8 text-center font-bold" :class="item.rank <= 3 ? 'text-dx-primary' : 'text-dx-muted'">
          {{ item.rank }}
        </span>
        <img v-if="item.avatar" :src="item.avatar" alt="" class="h-10 w-10 rounded-full object-cover" />
        <div v-else class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium">
          {{ item.nickname.slice(0, 1) }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">{{ item.nickname }}</p>
          <p class="text-xs text-dx-muted">
            {{ t('leaderboard.userStats', { checkins: item.checkinCount ?? 0, points: item.totalPoints ?? 0 }) }}
          </p>
        </div>
        <span class="font-semibold text-dx-text">{{ item.value }}{{ metricUnit }}</span>
      </div>
    </div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { LeaderboardResult } from '@douxing/shared';
import { fetchLeaderboard } from '@/api/leaderboard';
import SubPageShell from '@/components/SubPageShell.vue';
import { useLocale } from '@/i18n/useLocale';

const { t } = useLocale();
const period = ref<'week' | 'month'>('week');
const metric = ref<'checkins' | 'points'>('points');
const summary = ref<LeaderboardResult | null>(null);
const loading = ref(true);

const periodOptions = computed(() => [
  { key: 'week' as const, label: t('leaderboard.periodWeek') },
  { key: 'month' as const, label: t('leaderboard.periodMonth') },
]);

const metricOptions = computed(() => [
  { key: 'checkins' as const, label: t('leaderboard.metricCheckins') },
  { key: 'points' as const, label: t('leaderboard.metricPoints') },
]);

const entries = computed(() => summary.value?.entries ?? []);
const periodLabel = computed(() => (period.value === 'week' ? t('leaderboard.thisWeek') : t('leaderboard.thisMonth')));
const metricLabel = computed(() =>
  metric.value === 'checkins' ? t('leaderboard.metricCheckins') : t('leaderboard.metricPoints'),
);
const metricUnit = computed(() =>
  metric.value === 'checkins' ? t('leaderboard.checkinUnit') : t('leaderboard.pointsUnit'),
);

async function load() {
  loading.value = true;
  try {
    summary.value = await fetchLeaderboard({ period: period.value, metric: metric.value, limit: 50 });
  } finally {
    loading.value = false;
  }
}

watch([period, metric], () => {
  void load();
});

onMounted(() => {
  void load();
});
</script>
