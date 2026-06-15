<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="load" @reset="resetSearch">
        <a-form-item :label="t('system.colName')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('system.searchJobKeyword')"
            allow-clear
            style="width: 240px"
            @press-enter="load"
          />
        </a-form-item>
        <a-form-item :label="t('system.colJobStatus')">
          <a-select
            v-model:value="statusFilter"
            :options="statusOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('system.allJobStatuses')"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

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
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.monitorJobs');

const { t } = useI18n();
const keyword = ref('');
const statusFilter = ref<string | undefined>();
const items = ref<ScheduledJobRow[]>([]);
const loading = ref(false);

const statusOptions = computed(() => [
  { label: t('system.jobStatusPending'), value: 'pending' },
]);

const columns = computed<TableColumnsType<ScheduledJobRow>>(() => [
  { title: t('system.colName'), dataIndex: 'name' },
  { title: t('system.colCron'), dataIndex: 'cron', width: 120 },
  { title: t('system.colJobStatus'), dataIndex: 'status', width: 100 },
  { title: t('system.colRemark'), dataIndex: 'remark', ellipsis: true },
]);

function resetSearch() {
  keyword.value = '';
  statusFilter.value = undefined;
  void load();
}

async function load() {
  loading.value = true;
  try {
    items.value = await fetchScheduledJobs({
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value,
    });
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
