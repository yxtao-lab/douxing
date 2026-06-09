<template>
  <PageContainer admin>
    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <a-tooltip :title="t('system.refresh')">
            <a-button :loading="loading" @click="reload">
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
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 1 ? 'success' : 'error'">
            {{ record.status === 1 ? t('system.statusNormal') : t('common.failed') }}
          </a-tag>
        </template>
      </template>
    </DouxingAdminTable>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import { fetchOperLogsPage, type OperLogRow } from '@/api/system';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.logOper');

const { t } = useI18n();
const { items, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<OperLogRow>(fetchOperLogsPage);

const columns = computed<TableColumnsType<OperLogRow>>(() => [
  { title: t('system.colOperTitle'), dataIndex: 'title', width: 120 },
  { title: t('system.colOperName'), dataIndex: 'operName', width: 100 },
  { title: t('system.colOperUrl'), dataIndex: 'operUrl', ellipsis: true },
  { title: t('system.colMethod'), dataIndex: 'method', width: 80 },
  { title: t('system.colOperIp'), dataIndex: 'operIp', width: 120 },
  { title: t('system.colStatus'), key: 'status', width: 90 },
  {
    title: t('system.colOperTime'),
    dataIndex: 'operTime',
    width: 160,
    customRender: ({ text }) => String(text).slice(0, 19).replace('T', ' '),
  },
]);

onMounted(load);
</script>
