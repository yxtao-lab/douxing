<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('system.colUsername')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('system.searchLoginKeyword')"
            allow-clear
            style="width: 240px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('system.colStatus')">
          <a-select
            v-model:value="statusFilter"
            :options="statusOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('common.statusAll')"
          />
        </a-form-item>
        <a-form-item :label="t('system.colLoginTime')">
          <a-range-picker
            v-model:value="dateRange"
            value-format="YYYY-MM-DD"
            style="width: 240px"
            :placeholder="[t('common.dateRangeStart'), t('common.dateRangeEnd')]"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <AdminTableExportButton
            :columns="columns"
            :fetch-rows="fetchExportRows"
            name-key="web.logLogin"
          />
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
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { fetchLoginLogsPage, type LoginLogRow } from '@/api/system';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { fetchAllPaginatedRows } from '@/utils/fetchAllPaginatedRows';
import { formatAdminDateTime } from '@/utils/adminDateTime';
import { createAdminRowIndexColumn } from '@/utils/adminTableColumns';

usePageTitle('web.logLogin');

const { t } = useI18n();
const keyword = ref('');
const statusFilter = ref<number | undefined>();
const dateRange = ref<[string, string] | undefined>();

const statusOptions = computed(() => [
  { label: t('system.statusNormal'), value: 1 },
  { label: t('common.failed'), value: 0 },
]);

const { items, loading, pagination, page, pageSize, load, reload, handleTableChange } =
  useServerTablePagination<LoginLogRow>((page, pageSize) =>
    fetchLoginLogsPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
    }),
  );

const columns = computed<AdminExportColumn<LoginLogRow>[]>(() => [
  createAdminRowIndexColumn<LoginLogRow>(t('system.colRowIndex'), page, pageSize),
  { title: t('system.colUsername'), dataIndex: 'username', width: 120 },
  { title: t('system.colOperIp'), dataIndex: 'ip', width: 130 },
  { title: t('system.colBrowser'), dataIndex: 'browser', width: 100 },
  { title: t('system.colOs'), dataIndex: 'os', width: 100 },
  { title: t('system.colMsg'), dataIndex: 'msg', ellipsis: true },
  {
    title: t('system.colStatus'),
    key: 'status',
    width: 90,
    exportValue: (record) =>
      record.status === 1 ? t('system.statusNormal') : t('common.failed'),
  },
  {
    title: t('system.colLoginTime'),
    dataIndex: 'loginTime',
    width: 170,
    customRender: ({ text }) => formatAdminDateTime(text),
    exportValue: (record) => formatAdminDateTime(record.loginTime),
  },
]);

async function fetchExportRows(): Promise<Record<string, unknown>[]> {
  const rows = await fetchAllPaginatedRows((page, pageSize) =>
    fetchLoginLogsPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
    }),
  );
  return rows as unknown as Record<string, unknown>[];
}

function resetSearch() {
  keyword.value = '';
  statusFilter.value = undefined;
  dateRange.value = undefined;
  reload();
}

onMounted(load);
</script>
