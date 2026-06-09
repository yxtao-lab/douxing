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

    <div v-if="stats" class="admin-panel-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))">
      <a-card class="admin-stat-card" :bordered="false">
        <a-statistic
          :title="t('system.redisEnabled')"
          :value="stats.enabled ? t('common.yes') : t('common.no')"
        />
      </a-card>
      <a-card class="admin-stat-card" :bordered="false">
        <a-statistic
          :title="t('system.redisConnected')"
          :value="stats.connected ? t('system.redisConnected') : t('system.redisDisconnected')"
        />
      </a-card>
      <a-card class="admin-stat-card" :bordered="false">
        <a-statistic title="Keys" :value="stats.dbSize ?? 0" />
      </a-card>
    </div>
    <pre v-if="stats?.info" class="cache-info">{{ stats.info }}</pre>
  </PageContainer>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { fetchCacheMonitor } from '@/api/system';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.monitorCache');

const { t } = useI18n();
const loading = ref(false);
const stats = ref<{ enabled: boolean; connected: boolean; dbSize: number; info: string | null } | null>(
  null,
);

async function load() {
  loading.value = true;
  try {
    stats.value = (await fetchCacheMonitor()) as typeof stats.value;
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

.cache-info {
  margin-top: 16px;
  padding: 12px 16px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  font-size: 12px;
  max-height: 320px;
  overflow: auto;
}
</style>
