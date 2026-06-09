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

    <DouxingAdminTable
      :columns="columns"
      :data-source="items"
      :loading="loading"
      :empty-text="t('system.empty')"
      row-key="id"
      :pagination="false"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import { fetchScheduledJobs, type ScheduledJobRow } from '@/api/system';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.monitorJobs');

const { t } = useI18n();
const items = ref<ScheduledJobRow[]>([]);
const loading = ref(false);

const columns = computed<TableColumnsType<ScheduledJobRow>>(() => [
  { title: t('system.colName'), dataIndex: 'name' },
  { title: t('system.colCron'), dataIndex: 'cron', width: 120 },
  { title: t('system.colJobStatus'), dataIndex: 'status', width: 100 },
  { title: t('system.colRemark'), dataIndex: 'remark', ellipsis: true },
]);

async function load() {
  loading.value = true;
  try {
    items.value = await fetchScheduledJobs();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
