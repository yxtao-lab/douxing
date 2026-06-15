<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('system.colOperTitle')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('system.searchOperKeyword')"
            allow-clear
            style="width: 240px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('system.searchOperName')">
          <a-input
            v-model:value="operName"
            :placeholder="t('system.searchOperName')"
            allow-clear
            style="width: 160px"
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
        <a-form-item :label="t('system.colOperTime')">
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
import type { TableColumnsType } from 'ant-design-vue';
import { fetchOperLogsPage, type OperLogRow } from '@/api/system';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.logOper');

const { t } = useI18n();
const keyword = ref('');
const operName = ref('');
const statusFilter = ref<number | undefined>();
const dateRange = ref<[string, string] | undefined>();

const statusOptions = computed(() => [
  { label: t('system.statusNormal'), value: 1 },
  { label: t('common.failed'), value: 0 },
]);

const { items, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<OperLogRow>((page, pageSize) =>
    fetchOperLogsPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      operName: operName.value.trim() || undefined,
      status: statusFilter.value,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
    }),
  );

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

function resetSearch() {
  keyword.value = '';
  operName.value = '';
  statusFilter.value = undefined;
  dateRange.value = undefined;
  reload();
}

onMounted(load);
</script>
