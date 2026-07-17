<template>
  <div class="system-resources-page">
    <PageContainer admin>
      <template #toolbar>
        <AdminToolbar>
          <template #left>
            <div class="page-intro">
              <h2 class="page-intro-title">{{ t('systemResources.title') }}</h2>
              <p class="page-intro-desc">{{ t('systemResources.desc') }}</p>
            </div>
          </template>
          <template #right>
            <a-tooltip :title="t('systemResources.refresh')">
              <a-button type="primary" :loading="loading" @click="load(true)">
                <template #icon><ReloadOutlined /></template>
                {{ loading ? t('systemResources.refreshing') : t('systemResources.refresh') }}
              </a-button>
            </a-tooltip>
          </template>
        </AdminToolbar>
      </template>

      <a-spin :spinning="loading">
        <div v-if="stats" class="resources-page">
        <!-- 远程 Git 元信息 -->
        <a-alert type="info" show-icon class="git-meta-alert">
          <template #message>
            <span>{{ t('systemResources.sourceGitRemote') }}</span>
          </template>
          <template #description>
            <div class="git-meta-grid">
              <span>{{ t('systemResources.remoteUrl') }}: {{ stats.remoteUrl }}</span>
              <span>{{ t('systemResources.branch') }}: {{ stats.branch }}</span>
              <span>{{ t('systemResources.commitSha') }}: {{ shortSha }}</span>
              <span>{{ t('systemResources.commitAt') }}: {{ formattedCommitAt }}</span>
            </div>
          </template>
        </a-alert>

        <!-- 资源数量概览 -->
        <div class="overview-grid">
          <div
            v-for="(card, idx) in overviewCards"
            :key="card.labelKey"
            class="overview-card"
            :style="{ '--accent': OVERVIEW_CARD_COLORS[idx % OVERVIEW_CARD_COLORS.length] }"
          >
            <div class="overview-accent" />
            <a-statistic :title="card.title" :value="card.value" :value-style="{ color: 'var(--accent)' }" />
            <p class="overview-sub">{{ card.desc }}</p>
          </div>
        </div>

        <!-- 远程提交变更趋势 -->
        <a-row :gutter="[16, 16]" class="chart-row">
          <a-col :xs="24" :xl="14">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.commitTrendTitle') }}</template>
              <p class="chart-desc">{{ t('systemResources.commitTrendDesc') }}</p>
              <ResourceLineChart
                v-if="commitTrendData.length"
                :data="commitTrendData"
                :primary-name="t('systemResources.insertionsAxis')"
                :secondary-name="t('systemResources.deletionsAxis')"
                :tertiary-name="t('systemResources.totalLinesAxis')"
                height="320px"
              />
              <a-empty v-else :description="t('common.noData')" />
            </a-card>
          </a-col>
          <a-col :xs="24" :xl="10">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.moduleChurnTitle') }}</template>
              <p class="chart-desc">{{ t('systemResources.moduleChurnDesc') }}</p>
              <ResourceBarChart
                :data="moduleChurnData"
                :value-axis-name="t('systemResources.colInsertions')"
                horizontal
                height="320px"
              />
            </a-card>
          </a-col>
        </a-row>

        <!-- 子包规模：折线对比 + 柱状文件/行数 -->
        <a-row :gutter="[16, 16]" class="chart-row">
          <a-col :xs="24" :xl="14">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.packageTrendTitle') }}</template>
              <p class="chart-desc">{{ t('systemResources.packageTrendDesc') }}</p>
              <ResourceLineChart
                :data="packageTrendData"
                :primary-name="t('systemResources.fileCountAxis')"
                :secondary-name="t('systemResources.lineCountAxis')"
                height="340px"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :xl="10">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.fileTypeTitle') }}</template>
              <p class="chart-desc">{{ t('systemResources.fileTypeDesc') }}</p>
              <ResourceDonutChart
                :data="fileTypeFileCountData"
                :center-title="t('systemResources.fileTypeFileCount')"
                :center-sub="String(totalFileCount)"
                height="340px"
              />
            </a-card>
          </a-col>
        </a-row>

        <a-row :gutter="[16, 16]" class="chart-row">
          <a-col :xs="24" :xl="12">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.packageCodeTitle') }}</template>
              <p class="chart-desc">{{ t('systemResources.packageCodeDesc') }}</p>
              <ResourceBarChart
                :data="packageFileCountData"
                :value-axis-name="t('systemResources.fileCountAxis')"
                height="280px"
              />
              <ResourceBarChart
                :data="packageLineCountData"
                :value-axis-name="t('systemResources.lineCountAxis')"
                height="260px"
                style="margin-top: 12px"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :xl="12">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.radarTitle') }}</template>
              <p class="chart-desc">{{ t('systemResources.radarDesc') }}</p>
              <ResourceRadarChart
                :indicators="radarIndicators"
                :series="radarSeries"
                height="560px"
              />
            </a-card>
          </a-col>
        </a-row>

        <!-- 组件 / 页面 / 模块 / 插件 -->
        <a-row :gutter="[16, 16]" class="chart-row">
          <a-col :xs="24" :lg="12" :xl="6">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.componentsTitle') }}</template>
              <p class="chart-desc">{{ t('systemResources.componentsDesc') }}</p>
              <ResourceBarChart
                :data="componentsData"
                :value-axis-name="t('systemResources.fileCountAxis')"
                horizontal
                height="260px"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :lg="12" :xl="6">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.pagesTitle') }}</template>
              <p class="chart-desc">{{ t('systemResources.pagesDesc') }}</p>
              <ResourceBarChart
                :data="pagesData"
                :value-axis-name="t('systemResources.fileCountAxis')"
                horizontal
                height="260px"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :lg="12" :xl="6">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.modulesTitle') }}</template>
              <p class="chart-desc">{{ t('systemResources.modulesDesc') }}</p>
              <ResourceBarChart
                :data="modulesData"
                :value-axis-name="t('systemResources.fileCountAxis')"
                horizontal
                height="260px"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :lg="12" :xl="6">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.pluginsTitle') }}</template>
              <p class="chart-desc">{{ t('systemResources.pluginsDesc') }}</p>
              <ResourceDonutChart
                :data="pluginsData"
                :center-title="t('systemResources.pluginsCenter')"
                :center-sub="String(totalPlugins)"
                height="260px"
              />
            </a-card>
          </a-col>
        </a-row>

        <!-- 依赖 + i18n + 行数分布 -->
        <a-row :gutter="[16, 16]" class="chart-row">
          <a-col :xs="24" :xl="10">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.depsTitle') }}</template>
              <p class="chart-desc">{{ t('systemResources.depsDesc') }}</p>
              <ResourceBarChart
                :data="depsData"
                :value-axis-name="t('systemResources.colDeps')"
                horizontal
                height="280px"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :xl="7">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.i18nTitle') }}</template>
              <p class="chart-desc">{{ t('systemResources.i18nDesc') }}</p>
              <ResourceBarChart
                :data="i18nData"
                :value-axis-name="t('systemResources.colKeys')"
                height="280px"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :xl="7">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.fileTypeLineCount') }}</template>
              <p class="chart-desc">{{ t('systemResources.fileTypeDesc') }}</p>
              <ResourceDonutChart
                :data="fileTypeLineCountData"
                :center-title="t('systemResources.fileTypeLineCount')"
                :center-sub="formatCompact(totalLineCount)"
                height="280px"
              />
            </a-card>
          </a-col>
        </a-row>

        <!-- 文档与规则 -->
        <a-row :gutter="[16, 16]" class="chart-row">
          <a-col :span="24">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.docsTitle') }}</template>
              <template #extra>
                <AdminTableExportButton
                  :columns="docColumns"
                  :rows="docRows"
                  name-key="systemResources.docsTitle"
                  size="small"
                />
              </template>
              <p class="chart-desc">{{ t('systemResources.docsDesc') }}</p>
              <DouxingAdminTable
                :columns="docColumns"
                :data-source="docRows"
                :pagination="false"
                size="small"
                row-key="path"
                :auto-body-scroll="false"
                class="embed-table"
              />
            </a-card>
          </a-col>
        </a-row>

        <!-- 子包明细 -->
        <a-row :gutter="[16, 16]" class="chart-row">
          <a-col :span="24">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.packageDetailTitle') }}</template>
              <template #extra>
                <AdminTableExportButton
                  :columns="packageColumns"
                  :rows="packageRows"
                  name-key="systemResources.packageDetailTitle"
                  size="small"
                />
              </template>
              <DouxingAdminTable
                :columns="packageColumns"
                :data-source="packageRows"
                :pagination="false"
                size="small"
                row-key="name"
                :auto-body-scroll="false"
                class="embed-table"
              />
            </a-card>
          </a-col>
        </a-row>

        <!-- 模块明细 -->
        <a-row :gutter="[16, 16]" class="chart-row">
          <a-col :span="24">
            <a-card :bordered="false" class="chart-card">
              <template #title>{{ t('systemResources.modulesDetailTitle') }}</template>
              <template #extra>
                <AdminTableExportButton
                  :columns="moduleColumns"
                  :rows="moduleRows"
                  name-key="systemResources.modulesDetailTitle"
                  size="small"
                />
              </template>
              <DouxingAdminTable
                :columns="moduleColumns"
                :data-source="moduleRows"
                :pagination="false"
                size="small"
                row-key="name"
                :auto-body-scroll="false"
                class="embed-table"
              />
            </a-card>
          </a-col>
        </a-row>

        <div class="meta-info">
          <span>{{ t('systemResources.generatedAt') }}: {{ formattedGeneratedAt }}</span>
          <a-divider type="vertical" />
          <span>{{ t('systemResources.remoteUrl') }}: {{ stats.remoteUrl }}</span>
          <a-divider type="vertical" />
          <span>{{ t('systemResources.branch') }}: {{ stats.branch }}@{{ shortSha }}</span>
        </div>
      </div>
      <a-empty v-else :description="t('common.noData')" />
    </a-spin>
    </PageContainer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnType } from 'ant-design-vue';
import type { SystemResourcesStats } from '@douxing/shared';
import { fetchSystemResourcesStats } from '@/api/system-resources';
import PageContainer from '@/layouts/components/PageContainer.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import ResourceBarChart from '@/components/analytics/ResourceBarChart.vue';
import ResourceDonutChart from '@/components/analytics/ResourceDonutChart.vue';
import ResourceLineChart from '@/components/analytics/ResourceLineChart.vue';
import ResourceRadarChart from '@/components/analytics/ResourceRadarChart.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import { formatAdminDateTime } from '@/utils/adminDateTime';

usePageTitle('web.systemResources');

const { t } = useI18n();
const loading = ref(false);
const stats = ref<SystemResourcesStats | null>(null);

const OVERVIEW_CARD_COLORS = [
  '#1677ff',
  '#008cba',
  '#fa8c16',
  '#52c41a',
  '#722ed1',
  '#13c2c2',
  '#eb2f96',
  '#faad14',
  '#2f54eb',
  '#a0d911',
];

const overviewCards = computed(() => {
  if (!stats.value) return [];
  return stats.value.overview.map((item) => ({
    labelKey: item.labelKey,
    title: t(item.labelKey),
    value: item.value,
    desc: item.descKey ? t(item.descKey) : '',
  }));
});

const packageFileCountData = computed(() =>
  (stats.value?.packages ?? []).map((p) => ({ name: p.name, value: p.fileCount })),
);

const packageLineCountData = computed(() =>
  (stats.value?.packages ?? []).map((p) => ({ name: p.name, value: p.lineCount })),
);

const packageTrendData = computed(() =>
  (stats.value?.packages ?? []).map((p) => ({
    name: p.name,
    primary: p.fileCount,
    secondary: p.lineCount,
  })),
);

const commitTrendData = computed(() =>
  (stats.value?.commitTrends ?? []).map((d) => ({
    name: d.date,
    primary: d.sourceInsertions,
    secondary: d.sourceDeletions,
    tertiary: d.totalLines,
  })),
);

const moduleChurnData = computed(() =>
  (stats.value?.moduleChurn ?? [])
    .slice(0, 12)
    .map((m) => ({ name: m.name, value: m.insertions + m.deletions })),
);

const shortSha = computed(() => {
  const sha = stats.value?.commitSha ?? '';
  return sha.length > 10 ? sha.slice(0, 10) : sha;
});

const formattedCommitAt = computed(() =>
  stats.value?.commitAt ? formatAdminDateTime(stats.value.commitAt) : '-',
);

const fileTypeFileCountData = computed(() =>
  (stats.value?.fileTypes ?? []).map((f) => ({ name: `.${f.ext}`, value: f.fileCount })),
);

const fileTypeLineCountData = computed(() =>
  (stats.value?.fileTypes ?? []).map((f) => ({ name: `.${f.ext}`, value: f.lineCount })),
);

const totalFileCount = computed(() =>
  (stats.value?.fileTypes ?? []).reduce((s, f) => s + f.fileCount, 0),
);

const totalLineCount = computed(() =>
  (stats.value?.fileTypes ?? []).reduce((s, f) => s + f.lineCount, 0),
);

const componentsData = computed(() =>
  (stats.value?.componentsByApp ?? []).map((c) => ({ name: c.name, value: c.fileCount })),
);

const pagesData = computed(() =>
  (stats.value?.pagesByApp ?? []).map((p) => ({ name: p.name, value: p.fileCount })),
);

const modulesData = computed(() =>
  (stats.value?.modules ?? []).map((m) => ({ name: m.name, value: m.fileCount })),
);

const pluginsData = computed(() =>
  (stats.value?.plugins ?? []).map((p) => ({ name: p.name, value: p.fileCount })),
);

const totalPlugins = computed(() =>
  (stats.value?.plugins ?? []).reduce((s, p) => s + p.fileCount, 0),
);

const depsData = computed(() =>
  (stats.value?.dependencies ?? []).map((d) => ({ name: d.name, value: d.lineCount })),
);

const i18nData = computed(() =>
  (stats.value?.i18nKeys ?? []).map((k) => ({ name: t(k.labelKey), value: k.value })),
);

/**
 * 构建雷达图：取文件数最多的前 4 个子包，对比文件数 / 行数(千) / 组件 / 页面。
 *
 * @returns indicators 与 series；无数据时返回空
 */
const radarIndicators = computed(() => {
  const maxFiles = Math.max(...(stats.value?.packages ?? []).map((p) => p.fileCount), 1);
  const maxLinesK = Math.max(
    ...((stats.value?.packages ?? []).map((p) => Math.round(p.lineCount / 1000))),
    1,
  );
  const maxComp = Math.max(...(stats.value?.componentsByApp ?? []).map((c) => c.fileCount), 1);
  const maxPages = Math.max(...(stats.value?.pagesByApp ?? []).map((p) => p.fileCount), 1);
  return [
    { name: t('systemResources.radarDimFiles'), max: maxFiles },
    { name: t('systemResources.radarDimLinesK'), max: maxLinesK },
    { name: t('systemResources.radarDimComponents'), max: maxComp },
    { name: t('systemResources.radarDimPages'), max: maxPages },
  ];
});

const radarSeries = computed(() => {
  const top = [...(stats.value?.packages ?? [])]
    .sort((a, b) => b.lineCount - a.lineCount)
    .slice(0, 4);
  const compMap = new Map((stats.value?.componentsByApp ?? []).map((c) => [c.name, c.fileCount]));
  const pageMap = new Map((stats.value?.pagesByApp ?? []).map((p) => [p.name, p.fileCount]));
  return top.map((p) => ({
    name: p.name,
    values: [
      p.fileCount,
      Math.round(p.lineCount / 1000),
      compMap.get(p.name) ?? 0,
      pageMap.get(p.name) ?? 0,
    ],
  }));
});

const packageRows = computed(() => stats.value?.packages ?? []);
const docRows = computed(() => stats.value?.docs ?? []);
const moduleRows = computed(() => stats.value?.modules ?? []);

const packageColumns = computed<TableColumnType[]>(() => [
  { title: t('systemResources.colPackage'), dataIndex: 'name', key: 'name', width: 140 },
  { title: t('systemResources.colPath'), dataIndex: 'path', key: 'path' },
  { title: t('systemResources.colFileCount'), dataIndex: 'fileCount', key: 'fileCount', width: 120 },
  { title: t('systemResources.colLineCount'), dataIndex: 'lineCount', key: 'lineCount', width: 120 },
]);

const docColumns = computed<TableColumnType[]>(() => [
  { title: t('systemResources.colDocPath'), dataIndex: 'path', key: 'path' },
  { title: t('systemResources.colFileCount'), dataIndex: 'fileCount', key: 'fileCount', width: 140 },
  { title: t('systemResources.colLineCount'), dataIndex: 'lineCount', key: 'lineCount', width: 140 },
]);

const moduleColumns = computed<TableColumnType[]>(() => [
  { title: t('systemResources.colModule'), dataIndex: 'name', key: 'name', width: 180 },
  { title: t('systemResources.colPath'), dataIndex: 'path', key: 'path' },
  { title: t('systemResources.colFileCount'), dataIndex: 'fileCount', key: 'fileCount', width: 120 },
  { title: t('systemResources.colLineCount'), dataIndex: 'lineCount', key: 'lineCount', width: 120 },
]);

const formattedGeneratedAt = computed(() =>
  stats.value ? formatAdminDateTime(stats.value.generatedAt) : '-',
);

/**
 * 将大数字压缩为千分位展示字符串（图表中心副标题）。
 *
 * @param n - 原始数值
 * @returns 带千分位的字符串
 */
function formatCompact(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * 拉取系统资源统计；支持强制刷新后端缓存。
 *
 * @param forceRefresh - 是否强制重新扫描；默认 false
 * @returns Promise，完成后更新 `stats`
 */
async function load(forceRefresh = false) {
  loading.value = true;
  try {
    stats.value = await fetchSystemResourcesStats(forceRefresh);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
});
</script>

<style scoped>
.system-resources-page {
  min-height: 100%;
}

/* 长内容页：勿锁死 100% 高度，交给 layout content-inner 滚动 */
.system-resources-page :deep(.page-container) {
  height: auto;
  flex: none;
}

.system-resources-page :deep(.admin-page-card),
.system-resources-page :deep(.admin-page-card > .ant-card-body),
.system-resources-page :deep(.page-container-body) {
  height: auto;
  flex: none;
  overflow: visible;
}

.page-intro {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.page-intro-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  line-height: 1.3;
}

.page-intro-desc {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.4;
}

.resources-page {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.git-meta-alert {
  border-radius: 10px;
}

.git-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 4px 16px;
  font-size: 12px;
  word-break: break-all;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 12px;
}

.overview-card {
  position: relative;
  overflow: hidden;
  padding: 16px 16px 12px;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  background: linear-gradient(145deg, #ffffff 0%, #f7faff 100%);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.overview-accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: var(--accent, #1677ff);
}

.overview-sub {
  margin: 8px 0 0;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.4;
  min-height: 16px;
}

.chart-row {
  margin-bottom: 0;
}

.chart-card {
  height: 100%;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.chart-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #6b7280;
}

.embed-table {
  margin-top: 4px;
}

.meta-info {
  margin-top: 4px;
  padding: 12px 16px;
  font-size: 12px;
  color: #9ca3af;
  background: #fafafa;
  border-radius: 8px;
  word-break: break-all;
}
</style>
