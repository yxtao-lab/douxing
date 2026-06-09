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

    <div v-if="info" class="admin-desc-block">
      <a-descriptions bordered :column="2" size="small">
        <a-descriptions-item label="App">{{ info.appName }}</a-descriptions-item>
        <a-descriptions-item label="Node">{{ info.nodeVersion }}</a-descriptions-item>
        <a-descriptions-item label="Host">{{ info.hostname }}</a-descriptions-item>
        <a-descriptions-item label="Platform">{{ info.platform }}</a-descriptions-item>
        <a-descriptions-item :label="t('system.uptime')">{{ formatUptime(info.uptime) }}</a-descriptions-item>
        <a-descriptions-item :label="t('system.cpuCount')">{{ info.cpuCount }}</a-descriptions-item>
        <a-descriptions-item :label="t('system.heapUsed')">
          {{ formatBytes(info.memory?.heapUsed) }} / {{ formatBytes(info.memory?.heapTotal) }}
        </a-descriptions-item>
        <a-descriptions-item label="Memory">
          {{ formatBytes(info.freeMemory) }} free / {{ formatBytes(info.totalMemory) }}
        </a-descriptions-item>
      </a-descriptions>
    </div>
    <a-empty v-else :description="t('system.empty')" />
  </PageContainer>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { fetchServerMonitor } from '@/api/system';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.monitorServer');

const { t } = useI18n();
const loading = ref(false);
const info = ref<{
  appName: string;
  nodeVersion: string;
  hostname: string;
  platform: string;
  uptime: number;
  cpuCount: number;
  memory?: { heapUsed: number; heapTotal: number };
  freeMemory: number;
  totalMemory: number;
} | null>(null);

function formatBytes(n?: number) {
  if (!n) return '—';
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatUptime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

async function load() {
  loading.value = true;
  try {
    info.value = (await fetchServerMonitor()) as typeof info.value;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
