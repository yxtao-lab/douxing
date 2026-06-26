<template>
  <div class="travel-cockpit">
    <header class="travel-cockpit__header">
      <div class="travel-cockpit__header-center">
        <p class="travel-cockpit__eyebrow">{{ t('screen.travel.eyebrow') }}</p>
        <h1 class="travel-cockpit__title">{{ t('screen.travel.title') }}</h1>
      </div>
      <div class="travel-cockpit__header-right">
        <span class="travel-cockpit__clock">{{ clockText }}</span>
        <span class="travel-cockpit__range">{{ rangeLabel }}</span>
      </div>
    </header>

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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  AnalyticsCityGeoStat,
  AnalyticsFunnelStep,
  AnalyticsGeoDistribution,
  AnalyticsGeoFlow,
  AnalyticsOverview,
} from '@douxing/shared';
import { findCityRegionByCode } from '@douxing/shared';
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
const SCREEN_DAYS = 30;

const { t } = useI18n();
const { currentLocale } = useLocale();

const overview = ref<AnalyticsOverview | null>(null);
const geo = ref<AnalyticsGeoDistribution | null>(null);
const cityRankFallback = ref<AnalyticsCityGeoStat[]>([]);
const flows = ref<AnalyticsGeoFlow[]>([]);
const funnel = ref<AnalyticsFunnelStep[]>([]);
const clockText = ref('');
let clockTimer: ReturnType<typeof setInterval> | undefined;
let refreshTimer: ReturnType<typeof setInterval> | undefined;

const rangeLabel = computed(() => t('screen.travel.rangeDays', { days: SCREEN_DAYS }));

const cityRankItems = computed(() => {
  const geoCities = geo.value?.cities ?? [];
  if (geoCities.length > 0) return geoCities;
  return cityRankFallback.value;
});

const funnelStepLabels = computed<Record<string, string>>(() => ({
  planPage: t('analytics.funnelPlanPage'),
  planSubmit: t('analytics.funnelPlanSubmit'),
  planSession: t('analytics.funnelPlanSession'),
  routeSaved: t('analytics.funnelRouteSaved'),
  routePublish: t('analytics.funnelRoutePublish'),
  checkin: t('analytics.funnelCheckin'),
}));

function kpiSub(label: string, value: number) {
  return `${label} ${value.toLocaleString()}`;
}

function pickCityName(cityCode: string) {
  const region = findCityRegionByCode(cityCode);
  if (!region) return cityCode;
  return currentLocale.value === 'en-US' ? region.nameEn : region.nameZh;
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
  const now = new Date();
  clockText.value = now.toLocaleString();
}

async function loadData() {
  const [overviewData, geoData, flowData, funnelData] = await Promise.all([
    fetchAnalyticsOverview(),
    fetchAnalyticsGeoDistribution(SCREEN_DAYS),
    fetchAnalyticsGeoFlows(SCREEN_DAYS, 20),
    fetchAnalyticsFunnel(SCREEN_DAYS),
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
}

onMounted(() => {
  updateClock();
  clockTimer = setInterval(updateClock, 1000);
  void loadData();
  refreshTimer = setInterval(() => {
    void loadData().catch((err) => console.error('[screen/travel]', err));
  }, REFRESH_MS);
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<style scoped>
.travel-cockpit {
  width: 1920px;
  height: 1080px;
  padding: 18px 22px 22px;
  box-sizing: border-box;
  color: #e6f7ff;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background:
    radial-gradient(circle at 15% 10%, rgba(0, 120, 200, 0.12), transparent 35%),
    radial-gradient(circle at 85% 80%, rgba(0, 180, 120, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(2, 10, 20, 0.35), rgba(2, 8, 16, 0.65));
}

.travel-cockpit__header {
  position: relative;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-height: 72px;
}

.travel-cockpit__header-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  width: max-content;
  max-width: calc(100% - 280px);
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

.travel-cockpit__range {
  font-size: 14px;
  color: rgba(186, 231, 255, 0.8);
}

.travel-cockpit__kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.travel-cockpit__main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 320px 1fr 360px;
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
</style>
