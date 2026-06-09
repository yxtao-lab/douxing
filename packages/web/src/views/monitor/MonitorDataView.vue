<template>
  <PageContainer admin>
    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <a-tooltip :title="t('system.refresh')">
            <a-button :loading="loading" @click="load">
              <template #icon><ReloadOutlined /></template>
            </a-button>
          </a-tooltip>
        </template>
      </AdminToolbar>
    </template>

    <div v-if="stats" class="admin-panel-grid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))">
      <a-card v-for="card in cards" :key="card.key" class="admin-stat-card" :bordered="false">
        <a-statistic :title="card.title" :value="card.value" />
      </a-card>
    </div>
    <a-empty v-else :description="t('system.empty')" />
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { fetchDataMonitor } from '@/api/system';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.monitorData');

const { t } = useI18n();
const loading = ref(false);
const stats = ref<Record<string, { total?: number }> | null>(null);

const cards = computed(() => {
  if (!stats.value) return [];
  const map: Record<string, string> = {
    users: t('analytics.usersTotal'),
    routes: t('analytics.routesTotal'),
    orders: t('analytics.ordersTotal'),
    checkins: t('analytics.checkinsTotal'),
    planSessions: t('analytics.planSessionsTotal'),
  };
  return Object.entries(map).map(([key, title]) => ({
    key,
    title,
    value: stats.value?.[key]?.total ?? 0,
  }));
});

async function load() {
  loading.value = true;
  try {
    stats.value = (await fetchDataMonitor()) as Record<string, { total?: number }>;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.admin-stat-card {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fafafa;
}
</style>
