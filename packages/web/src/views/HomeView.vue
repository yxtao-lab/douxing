<template>
  <div class="workbench">
    <a-page-header
      class="workbench-header"
      :title="welcomeText"
      :sub-title="t('home.desc')"
    />

    <a-row :gutter="[16, 16]" class="stats-row">
      <a-col :xs="12" :sm="12" :md="6">
        <a-card>
          <a-statistic :title="t('home.statRoutes')" :value="stats.routes" />
        </a-card>
      </a-col>
      <a-col :xs="12" :sm="12" :md="6">
        <a-card>
          <a-statistic :title="t('home.statOrders')" :value="stats.orders" />
        </a-card>
      </a-col>
      <a-col :xs="12" :sm="12" :md="6">
        <a-card>
          <a-statistic :title="t('home.statCheckins')" :value="stats.checkins" />
        </a-card>
      </a-col>
      <a-col :xs="12" :sm="12" :md="6">
        <a-card>
          <a-statistic :title="t('home.statPending')" :value="stats.pending" />
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="[16, 16]" class="main-row">
      <a-col :xs="24" :lg="16">
        <div class="main-stack">
          <WorkbenchPanel :title="t('home.mySites')">
            <template #extra>
              <a-button type="link" size="small" class="panel-link" @click="openApiHealth">
                <GlobalOutlined />
                {{ t('home.visitAll') }}
              </a-button>
            </template>

            <div class="site-grid">
              <component
                :is="siteLinkComponent(site)"
                v-for="site in sites"
                :key="site.id"
                v-bind="siteLinkProps(site)"
                class="site-card"
              >
                <div class="site-card-top">
                  <span class="site-icon" aria-hidden="true">{{ site.emoji }}</span>
                  <span class="site-status" :class="{ online: serviceOnline }">
                    <span class="site-status-dot" aria-hidden="true" />
                    {{ serviceOnline ? t('home.online') : t('home.offline') }}
                  </span>
                </div>
                <h4 class="site-title">{{ t(site.titleKey) }}</h4>
                <p class="site-desc">{{ t(site.descKey) }}</p>
                <div class="site-tags">
                  <a-tag v-for="tagKey in site.tagKeys" :key="tagKey" class="site-tag">
                    {{ t(tagKey) }}
                  </a-tag>
                </div>
              </component>
            </div>
          </WorkbenchPanel>

          <WorkbenchPanel :title="t('home.changelogTitle')">
            <template #extra>
              <a-space :size="4">
                <a-button type="link" size="small" class="panel-link" @click="toggleChangelogExpand">
                  <DoubleRightOutlined :class="{ expanded: changelogExpandedAll }" class="expand-icon" />
                  {{ changelogExpandedAll ? t('home.collapseAll') : t('home.expandAll') }}
                </a-button>
                <a-button type="link" size="small" class="panel-link" @click="expandLatestChangelog">
                  <HistoryOutlined />
                  {{ t('home.viewAllChangelog') }}
                </a-button>
              </a-space>
            </template>

            <WorkbenchChangelog v-model:active-keys="changelogActiveKeys" :items="changelog" />
          </WorkbenchPanel>
        </div>
      </a-col>

      <a-col :xs="24" :lg="8">
        <div class="side-stack">
          <SiteStatusPanel />

          <WorkbenchPanel :title="t('home.latestNotices')">
            <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE">
              <template #description>
                <span>{{ t('home.noNotices') }}</span>
                <p class="empty-desc">{{ t('home.noNoticesDesc') }}</p>
              </template>
            </a-empty>
          </WorkbenchPanel>

          <WorkbenchPanel :title="t('home.systemInfo')">
            <div class="info-scroll overlay-scrollbar">
              <section
                v-for="group in systemInfoGroups"
                :key="group.titleKey"
                class="info-group"
              >
                <h4 class="info-group-title">{{ t(group.titleKey) }}</h4>
                <dl class="info-list">
                  <div v-for="row in group.rows" :key="row.labelKey" class="info-row">
                    <dt>{{ t(row.labelKey) }}</dt>
                    <dd>{{ resolveSystemInfoValue(row) }}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </WorkbenchPanel>

          <WorkbenchPanel :title="t('home.quickActions')">
            <div class="action-grid">
              <router-link
                v-for="action in quickActions"
                :key="action.id"
                :to="action.to"
                class="action-item"
              >
                <span class="action-icon" :class="`action-icon-${action.icon}`">
                  <component :is="quickActionIcon(action.icon)" />
                </span>
                <span class="action-label">{{ t(action.labelKey) }}</span>
              </router-link>
            </div>
          </WorkbenchPanel>
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Empty } from 'ant-design-vue';
import {
  AuditOutlined,
  DoubleRightOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  HistoryOutlined,
  NodeIndexOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons-vue';
import http from '@/api/http';
import { fetchRoutesPage } from '@/api/routes';
import { fetchOrdersPage } from '@/api/orders';
import { fetchCheckInsPage } from '@/api/checkins';
import { fetchPendingAttractionsPage } from '@/api/attractions';
import type { ApiResponse } from '@douxing/shared';
import { normalizePaginatedResult } from '@douxing/shared';
import {
  WORKBENCH_CHANGELOG,
  WORKBENCH_QUICK_ACTIONS,
  WORKBENCH_SITES,
  type WorkbenchSiteItem,
} from '@/data/workbench';
import {
  WORKBENCH_SYSTEM_INFO_GROUPS,
  type WorkbenchSystemInfoRow,
} from '@/data/workbench-system-info';
import WorkbenchChangelog from '@/components/workbench/WorkbenchChangelog.vue';
import WorkbenchPanel from '@/components/workbench/WorkbenchPanel.vue';
import SiteStatusPanel from '@/components/system/SiteStatusPanel.vue';
import { useUserStore } from '@/stores/user';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.home');

const APP_VERSION = '1.0.0';

const { t } = useI18n();
const userStore = useUserStore();
const health = ref<{ name: string; status: string; timestamp: string } | null>(null);
const stats = ref({ routes: 0, orders: 0, checkins: 0, pending: 0 });
const serverTime = ref('');
const changelogActiveKeys = ref<string[]>([WORKBENCH_CHANGELOG[0]?.id ?? '']);

const sites = WORKBENCH_SITES;
const changelog = WORKBENCH_CHANGELOG;
const quickActions = WORKBENCH_QUICK_ACTIONS;
const systemInfoGroups = WORKBENCH_SYSTEM_INFO_GROUPS;

let serverTimeTimer: ReturnType<typeof setInterval> | null = null;

const welcomeText = computed(() =>
  t('home.welcome', {
    name: userStore.user?.nickname || userStore.user?.username || '',
  }),
);

const serviceOnline = computed(() => health.value?.status === 'ok');

const changelogExpandedAll = computed(
  () => changelogActiveKeys.value.length === changelog.length,
);

function resolveSystemInfoValue(row: WorkbenchSystemInfoRow) {
  if (row.dynamic === 'version') {
    return t(row.valueKey, { version: APP_VERSION });
  }
  if (row.dynamic === 'serverTime') {
    return serverTime.value || t(row.valueKey);
  }
  return t(row.valueKey);
}

function siteLinkComponent(site: WorkbenchSiteItem) {
  if (site.to) return 'router-link';
  if (site.href) return 'a';
  return 'div';
}

function siteLinkProps(site: WorkbenchSiteItem) {
  if (site.to) return { to: site.to };
  if (site.href) return { href: site.href, target: '_blank', rel: 'noopener noreferrer' };
  return {};
}

function quickActionIcon(icon: string) {
  if (icon === 'checkinMap') return EnvironmentOutlined;
  if (icon === 'attractions') return AuditOutlined;
  if (icon === 'playbooks') return NodeIndexOutlined;
  return UnorderedListOutlined;
}

function toggleChangelogExpand() {
  changelogActiveKeys.value = changelogExpandedAll.value
    ? []
    : changelog.map((item) => item.id);
}

function expandLatestChangelog() {
  changelogActiveKeys.value = changelog.map((item) => item.id);
}

function openApiHealth() {
  window.open('/api/health', '_blank', 'noopener,noreferrer');
}

function formatServerTime(iso: string) {
  return iso.replace('T', ' ').slice(0, 19);
}

function syncServerTimeFromHealth() {
  if (health.value?.timestamp) {
    serverTime.value = formatServerTime(health.value.timestamp);
  }
}

async function loadStats() {
  const [routes, orders, checkins, pending] = await Promise.allSettled([
    fetchRoutesPage(1, 1),
    fetchOrdersPage(1, 1),
    fetchCheckInsPage({ page: 1, pageSize: 1, all: true }),
    fetchPendingAttractionsPage(1, 1),
  ]);
  stats.value.routes =
    routes.status === 'fulfilled' ? normalizePaginatedResult(routes.value).total : 0;
  stats.value.orders =
    orders.status === 'fulfilled' ? normalizePaginatedResult(orders.value).total : 0;
  stats.value.checkins =
    checkins.status === 'fulfilled' ? normalizePaginatedResult(checkins.value).total : 0;
  stats.value.pending =
    pending.status === 'fulfilled' ? normalizePaginatedResult(pending.value).total : 0;
}

async function loadHealth() {
  try {
    const { data } = await http.get<ApiResponse<{ name: string; status: string; timestamp: string }>>(
      '/health',
    );
    health.value = data.data;
    syncServerTimeFromHealth();
  } catch {
    health.value = null;
  }
}

onMounted(async () => {
  loadStats();
  await loadHealth();
  serverTimeTimer = setInterval(() => {
    if (health.value?.timestamp) {
      const next = new Date(health.value.timestamp).getTime() + 1000;
      health.value = { ...health.value, timestamp: new Date(next).toISOString() };
      syncServerTimeFromHealth();
    }
  }, 1000);
});

onUnmounted(() => {
  if (serverTimeTimer) clearInterval(serverTimeTimer);
});
</script>

<style scoped>
.workbench {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.workbench-header {
  padding: 0 0 16px;
  background: transparent;
}

.stats-row {
  margin-bottom: 16px;
}

.main-row {
  align-items: stretch;
}

.main-stack,
.side-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.panel-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  height: auto;
  font-size: 13px;
}

.site-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 992px) {
  .site-grid {
    grid-template-columns: 1fr;
  }
}

.site-card {
  display: block;
  padding: 14px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

a.site-card:hover,
.site-card[href]:hover {
  border-color: rgba(22, 119, 255, 0.35);
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.08);
}

.site-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.site-icon {
  font-size: 28px;
  line-height: 1;
}

.site-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
}

.site-status.online {
  color: #16a34a;
}

.site-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.site-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.site-desc {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.5;
  color: #6b7280;
}

.site-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.site-tag {
  margin: 0;
  border: none;
  background: #fff;
  color: #64748b;
  font-size: 11px;
}

.expand-icon {
  transition: transform 0.2s ease;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.empty-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
}

.info-scroll {
  max-height: 420px;
  overflow-y: auto;
  overflow-x: hidden;
  /* 滚动条贴卡片右缘，不挤压内容 */
  margin-right: -16px;
  padding-right: 8px;
}

.info-group + .info-group {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #f0f0f0;
}

.info-group-title {
  margin: 0 0 8px;
  padding: 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  letter-spacing: 0.02em;
}

.info-list {
  margin: 0;
}

.info-row {
  display: flex;
  gap: 10px;
  padding: 7px 2px;
  font-size: 12px;
  line-height: 1.5;
}

.info-row dt {
  flex: 0 0 76px;
  margin: 0;
  color: #9ca3af;
}

.info-row dd {
  flex: 1;
  margin: 0;
  color: #111827;
  word-break: break-word;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 8px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  color: #374151;
  text-decoration: none;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.action-item:hover {
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  font-size: 18px;
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.action-label {
  font-size: 12px;
  text-align: center;
  line-height: 1.35;
}
</style>
