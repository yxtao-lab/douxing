<template>
  <a-spin :spinning="loading" size="large" class="travel-cockpit-spin">
    <div class="travel-cockpit">
      <header class="travel-cockpit__header">
        <div class="travel-cockpit__header-center">
          <p class="travel-cockpit__eyebrow">{{ t('screen.travel.eyebrow') }}</p>
          <h1 class="travel-cockpit__title">{{ t('screen.travel.title') }}</h1>
        </div>
        <div class="travel-cockpit__header-right">
          <span class="travel-cockpit__clock">{{ clockText }}</span>
          <div class="travel-cockpit__meta">
            <span class="travel-cockpit__range">{{ rangeLabel }}</span>
            <span v-if="geoScopeBadge" class="travel-cockpit__scope-badge">{{ geoScopeBadge }}</span>
          </div>
          <div class="travel-cockpit__days" role="group" :aria-label="t('screen.travel.daysLabel')">
            <button
              v-for="option in dayOptions"
              :key="option"
              type="button"
              class="travel-cockpit__days-btn"
              :class="{ 'travel-cockpit__days-btn--active': screenDays === option }"
              @click="setScreenDays(option)"
            >
              {{ t('screen.travel.daysOption', { days: option }) }}
            </button>
          </div>
        </div>
      </header>

      <p v-if="loadError" class="travel-cockpit__error">{{ loadError }}</p>

      <section class="travel-cockpit__kpis">
        <ScreenKpiCard
          :label="t('analytics.usersTotal')"
          :value="overview?.users.total ?? 0"
          :sub="kpiSub(t('analytics.new7d'), overview?.users.newLast7Days ?? 0)"
        />
        <ScreenKpiCard
          :label="t('analytics.routesTotal')"
          :value="overview?.routes.total ?? 0"
          :sub="kpiSub(t('analytics.publicRoutes'), overview?.routes.publicTotal ?? 0)"
        />
        <ScreenKpiCard
          :label="t('analytics.ordersTotal')"
          :value="overview?.orders.total ?? 0"
          :sub="kpiSub(t('analytics.paidOrders'), overview?.orders.paidTotal ?? 0)"
        />
        <ScreenKpiCard
          :label="t('analytics.checkinsTotal')"
          :value="overview?.checkins.total ?? 0"
          :sub="kpiSub(t('analytics.approvedCheckins'), overview?.checkins.approvedTotal ?? 0)"
        />
        <ScreenKpiCard
          :label="t('analytics.planSessionsTotal')"
          :value="overview?.planSessions.total ?? 0"
          :sub="kpiSub(t('analytics.new7d'), overview?.planSessions.newLast7Days ?? 0)"
        />
      </section>

      <section class="travel-cockpit__main">
        <div class="travel-cockpit__col travel-cockpit__col--left">
          <ScreenPanel :title="t('screen.travel.cityRankTitle')" class="travel-cockpit__panel-fill">
            <ScreenCityRankList :items="cityRankItems" :empty-label="t('common.noData')" />
          </ScreenPanel>
        </div>

        <div class="travel-cockpit__col travel-cockpit__col--center">
          <ScreenPanel :title="t('screen.travel.mapTitle')" class="travel-cockpit__panel-fill">
            <TravelGeoMap
              :provinces="geo?.provinces ?? []"
              :cities="geo?.cities ?? []"
              :flows="flows"
              :heat-points="geo?.heatPoints ?? []"
              :empty-label="t('common.noData')"
            />
          </ScreenPanel>
        </div>

        <div class="travel-cockpit__col travel-cockpit__col--right">
          <ScreenPanel :title="t('screen.travel.funnelTitle')" class="travel-cockpit__panel-half">
            <JourneyFunnelChart
              :steps="funnel"
              :labels="funnelStepLabels"
              :empty-label="t('common.noData')"
            />
          </ScreenPanel>
          <ScreenPanel :title="t('screen.travel.flowTitle')" compact class="travel-cockpit__panel-half">
            <ul class="travel-cockpit__flows">
              <li v-for="flow in flows.slice(0, 6)" :key="`${flow.fromCityCode}-${flow.toCityCode}`">
                <span>{{ flow.fromName }}</span>
                <span class="travel-cockpit__flow-arrow">→</span>
                <span>{{ flow.toName }}</span>
                <em>{{ flow.count }}</em>
              </li>
              <li v-if="flows.length === 0" class="travel-cockpit__flows-empty">{{ t('common.noData') }}</li>
            </ul>
          </ScreenPanel>
        </div>
      </section>

      <footer v-if="geo?.generatedAt" class="travel-cockpit__footer">
        {{ t('screen.travel.updatedAt', { time: formatGeneratedAt(geo.generatedAt) }) }}
      </footer>
    </div>
  </a-spin>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  AnalyticsCityGeoStat,
  AnalyticsFunnelStep,
  AnalyticsGeoDistribution,
  AnalyticsGeoFlow,
  AnalyticsOverview,
} from '@douxing/shared';
import { findCityRegionByCode, formatDisplayDateTime } from '@douxing/shared';
import {
  fetchAnalyticsFunnel,
  fetchAnalyticsGeoDistribution,
  fetchAnalyticsGeoFlows,
  fetchAnalyticsOverview,
  fetchTopCheckinCities,
} from '@/api/analytics';
import { useLocale } from '@/i18n/useLocale';
import ScreenPanel from '@/components/screen/ScreenPanel.vue';
import ScreenKpiCard from '@/components/screen/ScreenKpiCard.vue';
import ScreenCityRankList from '@/components/screen/ScreenCityRankList.vue';
import TravelGeoMap from '@/components/screen/TravelGeoMap.vue';
import JourneyFunnelChart from '@/components/screen/JourneyFunnelChart.vue';

const REFRESH_MS = 60_000;
const DAY_OPTIONS = [7, 30, 90] as const;

const { t } = useI18n();
const { currentLocale } = useLocale();

const overview = ref<AnalyticsOverview | null>(null);
const geo = ref<AnalyticsGeoDistribution | null>(null);
const cityRankFallback = ref<AnalyticsCityGeoStat[]>([]);
const flows = ref<AnalyticsGeoFlow[]>([]);
const funnel = ref<AnalyticsFunnelStep[]>([]);
const screenDays = ref<number>(30);
const loading = ref(false);
const loadError = ref('');
const clockText = ref('');
let clockTimer: ReturnType<typeof setInterval> | undefined;
let refreshTimer: ReturnType<typeof setInterval> | undefined;

const dayOptions = DAY_OPTIONS;

const rangeLabel = computed(() => t('screen.travel.rangeDays', { days: screenDays.value }));

const geoScopeBadge = computed(() => {
  if (geo.value?.effectiveScope === 'allTime') {
    return t('screen.travel.scopeAllTime');
  }
  return '';
});

const funnelStepLabels = computed<Record<string, string>>(() => ({
  planPage: t('analytics.funnelPlanPage'),
  planSubmit: t('analytics.funnelPlanSubmit'),
  planSession: t('analytics.funnelPlanSession'),
  routeSaved: t('analytics.funnelRouteSaved'),
  routePublish: t('analytics.funnelRoutePublish'),
  checkin: t('analytics.funnelCheckin'),
}));

const cityRankItems = computed(() => {
  const geoCities = geo.value?.cities ?? [];
  if (geoCities.length > 0) return geoCities;
  return cityRankFallback.value;
});

function kpiSub(label: string, value: number) {
  return `${label} ${value.toLocaleString()}`;
}

function pickCityName(cityCode: string) {
  const region = findCityRegionByCode(cityCode);
  if (!region) return cityCode;
  return currentLocale.value === 'en-US' ? region.nameEn : region.nameZh;
}

function formatGeneratedAt(iso: string) {
  return formatDisplayDateTime(iso) || iso;
}

async function loadCityRankFallback() {
  const topCities = await fetchTopCheckinCities(10);
  cityRankFallback.value = topCities.map((item) => ({
    cityCode: item.cityCode,
    cityName: pickCityName(item.cityCode),
    latitude: 0,
    longitude: 0,
    checkinCount: item.checkinCount,
  }));
}

function updateClock() {
  clockText.value = formatDisplayDateTime(new Date());
}

async function loadData() {
  loading.value = true;
  loadError.value = '';
  const days = screenDays.value;
  try {
    const [overviewData, geoData, flowData, funnelData] = await Promise.all([
      fetchAnalyticsOverview(),
      fetchAnalyticsGeoDistribution(days),
      fetchAnalyticsGeoFlows(days, 20),
      fetchAnalyticsFunnel(days),
    ]);
    overview.value = overviewData;
    geo.value = geoData;
    flows.value = flowData;
    funnel.value = funnelData;

    if ((geoData.cities?.length ?? 0) === 0) {
      await loadCityRankFallback();
    } else {
      cityRankFallback.value = [];
    }
  } catch (err) {
    console.error('[screen/travel]', err);
    loadError.value = t('screen.travel.loadFailed');
  } finally {
    loading.value = false;
  }
}

function setScreenDays(days: number) {
  if (screenDays.value === days) return;
  screenDays.value = days;
}

watch(screenDays, () => {
  void loadData();
});

onMounted(() => {
  updateClock();
  clockTimer = setInterval(updateClock, 1000);
  void loadData();
  refreshTimer = setInterval(() => {
    void loadData();
  }, REFRESH_MS);
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<style scoped>
.travel-cockpit-spin {
  width: 100%;
  height: 100%;
}

.travel-cockpit-spin :deep(.ant-spin-container) {
  width: 100%;
  height: 100%;
}

.travel-cockpit {
  width: 1920px;
  height: 1080px;
  padding: 18px 22px 16px;
  box-sizing: border-box;
  color: #e6f7ff;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background:
    radial-gradient(circle at 15% 10%, rgba(0, 120, 200, 0.12), transparent 35%),
    radial-gradient(circle at 85% 80%, rgba(0, 180, 120, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(2, 10, 20, 0.35), rgba(2, 8, 16, 0.65));
}

.travel-cockpit__header {
  position: relative;
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  min-height: 72px;
}

.travel-cockpit__header-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  width: max-content;
  max-width: calc(100% - 360px);
}

.travel-cockpit__eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.28em;
  color: rgba(64, 224, 255, 0.75);
}

.travel-cockpit__title {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-shadow: 0 0 18px rgba(64, 224, 255, 0.25);
}

.travel-cockpit__header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  color: rgba(230, 247, 255, 0.92);
}

.travel-cockpit__clock {
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.travel-cockpit__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.travel-cockpit__range {
  font-size: 14px;
  color: rgba(186, 231, 255, 0.8);
}

.travel-cockpit__scope-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 214, 102, 0.45);
  color: #ffd666;
  background: rgba(255, 214, 102, 0.08);
}

.travel-cockpit__days {
  display: flex;
  gap: 6px;
}

.travel-cockpit__days-btn {
  border: 1px solid rgba(0, 196, 255, 0.35);
  background: rgba(4, 20, 40, 0.55);
  color: rgba(186, 231, 255, 0.75);
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.travel-cockpit__days-btn:hover {
  border-color: rgba(64, 224, 255, 0.65);
  color: #e6f7ff;
}

.travel-cockpit__days-btn--active {
  border-color: rgba(64, 224, 255, 0.85);
  background: rgba(20, 90, 138, 0.55);
  color: #e6f7ff;
  box-shadow: 0 0 12px rgba(64, 224, 255, 0.2);
}

.travel-cockpit__error {
  margin: 0;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 120, 120, 0.35);
  background: rgba(120, 20, 20, 0.25);
  color: #ffb3b3;
  font-size: 13px;
}

.travel-cockpit__kpis {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.travel-cockpit__main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 300px 1fr 360px;
  gap: 12px;
}

.travel-cockpit__col {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.travel-cockpit__panel-fill {
  flex: 1;
  min-height: 0;
}

.travel-cockpit__panel-half {
  flex: 1;
  min-height: 0;
}

.travel-cockpit__panel-fill :deep(.screen-panel__body),
.travel-cockpit__panel-half :deep(.screen-panel__body) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.travel-cockpit__flows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
}

.travel-cockpit__flows li {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  gap: 6px;
  align-items: center;
  color: rgba(230, 247, 255, 0.88);
}

.travel-cockpit__flows em {
  font-style: normal;
  color: #ffd666;
  font-variant-numeric: tabular-nums;
}

.travel-cockpit__flow-arrow {
  color: rgba(64, 224, 255, 0.75);
}

.travel-cockpit__flows-empty {
  display: block;
  text-align: center;
  color: rgba(186, 231, 255, 0.45);
  padding: 16px 0;
}

.travel-cockpit__footer {
  text-align: right;
  font-size: 11px;
  color: rgba(186, 231, 255, 0.45);
  padding-top: 2px;
}
</style>
