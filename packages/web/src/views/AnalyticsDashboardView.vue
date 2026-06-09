<template>
  <div class="analytics-page">
    <a-page-header :title="t('analytics.title')" :sub-title="t('analytics.desc')" />

    <a-spin :spinning="loading">
      <a-row :gutter="[16, 16]" class="overview-row">
        <a-col :xs="12" :md="8" :xl="4">
          <a-card>
            <a-statistic :title="t('analytics.usersTotal')" :value="overview?.users.total ?? 0" />
            <p class="stat-sub">
              {{ t('analytics.newToday') }} {{ overview?.users.newToday ?? 0 }} ·
              {{ t('analytics.new7d') }} {{ overview?.users.newLast7Days ?? 0 }}
            </p>
          </a-card>
        </a-col>
        <a-col :xs="12" :md="8" :xl="4">
          <a-card>
            <a-statistic :title="t('analytics.routesTotal')" :value="overview?.routes.total ?? 0" />
            <p class="stat-sub">
              {{ t('analytics.publicRoutes') }} {{ overview?.routes.publicTotal ?? 0 }} ·
              {{ t('analytics.new7d') }} {{ overview?.routes.newLast7Days ?? 0 }}
            </p>
          </a-card>
        </a-col>
        <a-col :xs="12" :md="8" :xl="4">
          <a-card>
            <a-statistic :title="t('analytics.ordersTotal')" :value="overview?.orders.total ?? 0" />
            <p class="stat-sub">
              {{ t('analytics.paidOrders') }} {{ overview?.orders.paidTotal ?? 0 }} ·
              {{ t('analytics.new7d') }} {{ overview?.orders.newLast7Days ?? 0 }}
            </p>
          </a-card>
        </a-col>
        <a-col :xs="12" :md="8" :xl="4">
          <a-card>
            <a-statistic
              :title="t('analytics.checkinsTotal')"
              :value="overview?.checkins.total ?? 0"
            />
            <p class="stat-sub">
              {{ t('analytics.approvedCheckins') }} {{ overview?.checkins.approvedTotal ?? 0 }} ·
              {{ t('analytics.new7d') }} {{ overview?.checkins.newLast7Days ?? 0 }}
            </p>
          </a-card>
        </a-col>
        <a-col :xs="12" :md="8" :xl="4">
          <a-card>
            <a-statistic
              :title="t('analytics.planSessionsTotal')"
              :value="overview?.planSessions.total ?? 0"
            />
            <p class="stat-sub">
              {{ t('analytics.new7d') }} {{ overview?.planSessions.newLast7Days ?? 0 }}
            </p>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="[16, 16]" class="content-row">
        <a-col :xs="24" :xl="16">
          <a-card :title="t('analytics.trendsTitle')">
            <template #extra>
              <a-segmented v-model:value="trendDays" :options="trendDayOptions" @change="loadTrends" />
            </template>

            <AnalyticsTrendLineChart
              v-if="trends.length"
              :data="trends"
              :labels="trendSeriesLabels"
            />
            <a-empty v-else :description="t('common.noData')" />

            <a-table
              :columns="trendColumns"
              :data-source="trendTableRows"
              :pagination="trendTablePagination"
              size="small"
              row-key="date"
            />
          </a-card>
        </a-col>

        <a-col :xs="24" :xl="8">
          <a-card :title="t('analytics.cityRankTitle')">
            <a-table
              :columns="cityColumns"
              :data-source="cityRows"
              :pagination="false"
              size="small"
              row-key="cityCode"
            />
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnType } from 'ant-design-vue';
import type { AnalyticsDailyPoint, AnalyticsOverview } from '@douxing/shared';
import {
  fetchAnalyticsOverview,
  fetchAnalyticsTrends,
  fetchTopCheckinCities,
} from '@/api/analytics';
import AnalyticsTrendLineChart from '@/components/analytics/AnalyticsTrendLineChart.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import { createClientAdminPaginationConfig } from '@/utils/adminPagination';

usePageTitle('web.analytics');

const { t } = useI18n();
const loading = ref(false);
const overview = ref<AnalyticsOverview | null>(null);
const trends = ref<AnalyticsDailyPoint[]>([]);
const cityRows = ref<Array<{ cityCode: string; checkinCount: number; rank: number }>>([]);
const trendDays = ref<number>(30);

const trendDayOptions = computed(() => [
  { label: t('analytics.range7d'), value: 7 },
  { label: t('analytics.range30d'), value: 30 },
  { label: t('analytics.range90d'), value: 90 },
]);

const trendColumns = computed<TableColumnType[]>(() => [
  { title: t('analytics.colDate'), dataIndex: 'date', key: 'date', width: 110 },
  { title: t('analytics.metricUsers'), dataIndex: 'users', key: 'users', width: 72 },
  { title: t('analytics.metricRoutes'), dataIndex: 'routes', key: 'routes', width: 72 },
  { title: t('analytics.metricOrders'), dataIndex: 'orders', key: 'orders', width: 72 },
  { title: t('analytics.metricCheckins'), dataIndex: 'checkins', key: 'checkins', width: 72 },
  { title: t('analytics.metricPlanSessions'), dataIndex: 'planSessions', key: 'planSessions' },
]);

const cityColumns = computed<TableColumnType[]>(() => [
  { title: t('analytics.colRank'), dataIndex: 'rank', key: 'rank', width: 56 },
  { title: t('analytics.colCity'), dataIndex: 'cityCode', key: 'cityCode' },
  { title: t('analytics.colCheckins'), dataIndex: 'checkinCount', key: 'checkinCount', width: 88 },
]);

const trendTableRows = computed(() => [...trends.value].reverse());

const trendTablePagination = computed(() =>
  createClientAdminPaginationConfig({ pageSize: 10 }, (total, range) =>
    t('common.paginationTotal', { start: range[0], end: range[1], total }),
  ),
);

const trendSeriesLabels = computed(() => ({
  users: t('analytics.metricUsers'),
  routes: t('analytics.metricRoutes'),
  orders: t('analytics.metricOrders'),
  checkins: t('analytics.metricCheckins'),
  planSessions: t('analytics.metricPlanSessions'),
}));

async function loadOverview() {
  overview.value = await fetchAnalyticsOverview();
}

async function loadTrends() {
  trends.value = await fetchAnalyticsTrends(trendDays.value);
}

async function loadCities() {
  const rows = await fetchTopCheckinCities(10);
  cityRows.value = rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

async function loadAll() {
  loading.value = true;
  try {
    await Promise.all([loadOverview(), loadTrends(), loadCities()]);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadAll();
});
</script>

<style scoped>
.analytics-page {
  width: 100%;
  min-width: 0;
}

.overview-row,
.content-row {
  margin-bottom: 16px;
}

.stat-sub {
  margin: 8px 0 0;
  font-size: 12px;
  color: #6b7280;
}

.content-row :deep(.ant-table-wrapper) {
  margin-top: 16px;
}
</style>
